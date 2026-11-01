import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { postcodeSchema, type QuoteInput } from "./validation";
import { STATES, type State } from "./delivery-date";

const regions: Record<string, State> = {
  "Baden-Württemberg": "BW", Bayern: "BY", Berlin: "BE", Brandenburg: "BB", Bremen: "HB", Hamburg: "HH",
  Hessen: "HE", "Mecklenburg-Vorpommern": "MV", Niedersachsen: "NI", "Nordrhein-Westfalen": "NW",
  "Rheinland-Pfalz": "RP", Saarland: "SL", Sachsen: "SN", "Sachsen-Anhalt": "ST", "Schleswig-Holstein": "SH", Thüringen: "TH",
};
const dispatchCoordinates = [23.8787, 47.1425];
const geocodeSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
    properties: z.object({
      label: z.string(), name: z.string().optional(), postalcode: z.string().optional(), country_a: z.string().optional(),
      region: z.string().optional(), region_a: z.string().optional(), confidence: z.number().optional(),
      layer: z.string().optional(),
    }),
  })),
});
async function routingRequest(path: string, body?: unknown) {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new AppError("Die Lieferkostenberechnung ist noch nicht eingerichtet. Bitte fragen Sie die Fracht per E-Mail an.", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.openrouteservice.org/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: key, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Routing service connection failed", error instanceof Error ? error.name : "unknown");
    throw new AppError("Der Lieferkostenservice ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut.", 503);
  }
  if (!response.ok) {
    console.error("Routing service HTTP failure", response.status);
    throw new AppError("Die Lieferkosten konnten nicht berechnet werden. Bitte prüfen Sie Ihre Adresse oder kontaktieren Sie uns.", 503);
  }
  return response.json() as Promise<unknown>;
}
async function roadDistances(coordinates: number[][]) {
  const matrix = z.object({ distances: z.array(z.array(z.number().nonnegative().nullable())) }).safeParse(
    await routingRequest("v2/matrix/driving-hgv", { locations: coordinates, metrics: ["distance"], units: "m" }),
  );
  if (!matrix.success || matrix.data.distances.length !== coordinates.length || matrix.data.distances.some(row => row.length !== coordinates.length)) {
    throw new AppError("Der Routenservice hat eine ungültige Antwort geliefert.", 503);
  }
  return matrix.data.distances;
}
export async function calculatePostcodeDistance(postcode: string) {
  postcode = postcodeSchema.parse(postcode);
  const search = new URLSearchParams({ text: postcode, "boundary.country": "DE", layers: "postalcode", size: "3" });
  const parsed = geocodeSchema.safeParse(await routingRequest(`geocode/search?${search}`));
  if (!parsed.success) throw new AppError("Der Adressservice hat eine ungültige Antwort geliefert.", 503);
  const match = parsed.data.features.find(feature => feature.properties.country_a === "DEU"
    && feature.properties.layer === "postalcode"
    && (feature.properties.postalcode ?? feature.properties.name) === postcode);
  if (!match) throw new AppError("Die Liefer-PLZ konnte nicht eindeutig in Deutschland gefunden werden. Bitte prüfen Sie Ihre Postleitzahl.");
  const distances = await roadDistances([dispatchCoordinates, match.geometry.coordinates]);
  const metres = distances[0][1];
  if (metres === null || !Number.isFinite(metres) || metres <= 0) throw new AppError("Für diese Postleitzahl wurde keine befahrbare Lkw-Strecke gefunden.");
  return metres;
}
export async function calculateRoute(input: QuoteInput) {
  const locations = await Promise.all(input.deliveries.map(async ({ address }) => {
    const search = new URLSearchParams({ text: `${address.street}, ${address.postcode} ${address.city}`, "boundary.country": "DE", layers: "address", size: "3" });
    const parsed = geocodeSchema.safeParse(await routingRequest(`geocode/search?${search}`));
    if (!parsed.success) throw new AppError("Der Adressservice hat eine ungültige Antwort geliefert.", 503);
    const match = parsed.data.features.find(feature => feature.properties.country_a === "DEU"
      && feature.properties.postalcode === address.postcode
      && feature.properties.layer === "address"
      && (feature.properties.confidence ?? 0) >= 0.8);
    if (!match) throw new AppError(`Die Lieferadresse in ${address.postcode} ${address.city} konnte nicht eindeutig gefunden werden. Bitte Straße und Hausnummer prüfen.`);
    const code = match.properties.region_a?.replace(/^DE-/, "");
    const state = STATES.find(state => state === code) ?? regions[match.properties.region ?? ""];
    if (!state) throw new AppError("Das Bundesland der Lieferadresse konnte nicht ermittelt werden. Bitte kontaktieren Sie uns.", 503);
    return { coordinates: match.geometry.coordinates, state, label: match.properties.label };
  }));
  // The internal dispatch point is deliberately never returned to the storefront.
  const coordinates = [dispatchCoordinates, ...locations.map(location => location.coordinates)];
  const distances = await roadDistances(coordinates);
  for (let i = 1; i < coordinates.length; i++) {
    for (let j = 1; j < coordinates.length; j++) {
      if (i === j) continue;
      const metres = distances[i][j];
      if (metres === null) throw new AppError("Zwischen den Lieferadressen wurde keine befahrbare Lkw-Strecke gefunden.");
      if (metres > 20000) throw new AppError("Gemeinschaftsbestellungen sind nur möglich, wenn alle Lieferadressen untereinander höchstens 20 Straßenkilometer auseinanderliegen.");
    }
  }
  const permutations = (values: number[]): number[][] => values.length === 0 ? [[]] : values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
  const lengths = permutations(locations.map((_, index) => index + 1)).map(stops => {
    let last = 0;
    let total = 0;
    for (const stop of stops) {
      const distance = distances[last][stop];
      if (distance === null) return Infinity;
      total += distance;
      last = stop;
    }
    return total;
  });
  const metres = Math.min(...lengths);
  if (!Number.isFinite(metres) || metres <= 0) throw new AppError("Für diese Lieferung wurde keine befahrbare Lkw-Strecke gefunden.");
  return { metres, states: locations.map(location => location.state), labels: locations.map(location => location.label) };
}

import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import { postcodeSchema, type QuoteInput } from "./validation";
import { STATES, type State } from "./delivery-date";
import germanPostcodes from "./data/german-postcodes.json";

const regions: Record<string, State> = {
  "Baden-Württemberg": "BW", Bayern: "BY", Berlin: "BE", Brandenburg: "BB", Bremen: "HB", Hamburg: "HH",
  Hessen: "HE", "Mecklenburg-Vorpommern": "MV", Niedersachsen: "NI", "Nordrhein-Westfalen": "NW",
  "Rheinland-Pfalz": "RP", Saarland: "SL", Sachsen: "SN", "Sachsen-Anhalt": "ST", "Schleswig-Holstein": "SH", Thüringen: "TH",
};
const dispatchCoordinates = [23.8787, 47.1425];
const postcodeCoordinates: Readonly<Record<string, number[]>> = germanPostcodes.postcodes;
const geocodeSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
    properties: z.object({
      label: z.string(), postalcode: z.string().optional(), country_a: z.string().optional(),
      region: z.string().optional(), region_a: z.string().optional(), confidence: z.number().optional(),
      layer: z.string().optional(),
      street: z.string().optional(), housenumber: z.string().optional(),
      locality: z.string().optional(), localadmin: z.string().optional(),
    }),
  })),
});
class RoutingServiceError extends AppError {
  constructor(public fallbackAllowed: boolean) {
    super("Der Adress- oder Routenservice ist derzeit nicht verfügbar. Dies bedeutet nicht, dass Ihre Adresse falsch ist. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns per E-Mail.", 503);
  }
}
async function routingRequest(path: string, body?: unknown) {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new AppError("Die Preisberechnung ist noch nicht eingerichtet. Bitte fragen Sie Ihren Gesamtpreis inklusive Lieferung per E-Mail an.", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.openrouteservice.org/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: key, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
  } catch (error) {
    console.error("Routing service connection failed", error instanceof Error ? error.name : "unknown");
    throw new RoutingServiceError(true);
  }
  if (!response.ok) {
    const body = await response.text();
    console.error("Routing service HTTP failure", { status: response.status, service: path.split("?")[0], response: body.slice(0, 1000).replaceAll(key, "[redacted]") });
    throw new RoutingServiceError(response.status === 403 || response.status === 429 || response.status >= 500);
  }
  return response.json() as Promise<unknown>;
}
async function roadDistances(coordinates: number[][]) {
  let response: unknown;
  try {
    response = await routingRequest("v2/matrix/driving-hgv", { locations: coordinates, metrics: ["distance"], units: "m" });
  } catch (error) {
    if (!(error instanceof RoutingServiceError) || !error.fallbackAllowed) throw error;
    console.warn("Matrix service unavailable; calculating directed HGV road distances with the directions service.");
    return directionsDistances(coordinates);
  }
  const matrix = z.object({ distances: z.array(z.array(z.number().nonnegative().nullable())) }).safeParse(
    response,
  );
  if (!matrix.success || matrix.data.distances.length !== coordinates.length || matrix.data.distances.some(row => row.length !== coordinates.length)) {
    throw new AppError("Der Routenservice hat eine ungültige Antwort geliefert.", 503);
  }
  return matrix.data.distances;
}
async function directionsDistances(coordinates: number[][]) {
  const distances: (number | null)[][] = coordinates.map((_, i) => coordinates.map((_, j) => i === j ? 0 : null));
  const legs: Promise<void>[] = [];
  for (let from = 0; from < coordinates.length; from++) {
    for (let to = 1; to < coordinates.length; to++) {
      if (from === to) continue;
      legs.push((async () => {
        const parsed = z.object({
          routes: z.array(z.object({ summary: z.object({ distance: z.number().finite().nonnegative() }) })).min(1),
        }).safeParse(await routingRequest("v2/directions/driving-hgv/json", {
          coordinates: [coordinates[from], coordinates[to]], preference: "fastest", units: "m",
          geometry: false, instructions: false,
        }));
        if (!parsed.success) throw new AppError("Der Routenservice hat eine ungültige Antwort geliefert.", 503);
        distances[from][to] = parsed.data.routes[0].summary.distance;
      })());
    }
  }
  await Promise.all(legs);
  return distances;
}
export async function calculatePostcodeDistance(postcode: string) {
  postcode = postcodeSchema.parse(postcode);
  const coordinates = postcodeCoordinates[postcode];
  if (!coordinates) throw new AppError("Für diese Liefer-PLZ liegen noch keine Koordinaten vor. Bitte prüfen Sie die PLZ oder kontaktieren Sie uns für Ihren Preis inklusive Lieferung.");
  const distances = await roadDistances([dispatchCoordinates, coordinates]);
  const metres = distances[0][1];
  if (metres === null || !Number.isFinite(metres) || metres <= 0) throw new AppError("Für diese Postleitzahl wurde keine befahrbare Lkw-Strecke gefunden.");
  return metres;
}
function normaliseAddressPart(value: string) {
  return value.toLocaleLowerCase("de-DE").replaceAll("ß", "ss").replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}
function matchesAddressWithoutPostcode(feature: z.infer<typeof geocodeSchema>["features"][number], address: QuoteInput["deliveries"][number]["address"]) {
  const parts = address.street.trim().match(/^(.+?)\s+(\d+\s*[a-z]?(?:\s*[-/]\s*\d+\s*[a-z]?)?)$/i);
  const centre = postcodeCoordinates[address.postcode];
  if (!parts || !centre || !feature.properties.street || !feature.properties.housenumber) return false;
  const street = (value: string) => normaliseAddressPart(value).replace(/str(?:asse)?$/, "strasse");
  if (street(parts[1]) !== street(feature.properties.street)
    || normaliseAddressPart(parts[2]).replaceAll(" ", "") !== normaliseAddressPart(feature.properties.housenumber).replaceAll(" ", "")) return false;
  const city = normaliseAddressPart(address.city);
  const cityMatches = [feature.properties.localadmin, feature.properties.locality].some(value => {
    if (!value) return false;
    const name = normaliseAddressPart(value);
    return name === city || [" am ", " an der ", " im ", " bei "].some(suffix => name.startsWith(city + suffix));
  });
  if (!cityMatches) return false;
  // Missing provider postcodes require exact street/house/municipality plus local proximity.
  const radians = (value: number) => value * Math.PI / 180;
  const [longitude, latitude] = feature.geometry.coordinates;
  const a = Math.sin(radians(latitude - centre[1]) / 2) ** 2
    + Math.cos(radians(centre[1])) * Math.cos(radians(latitude)) * Math.sin(radians(longitude - centre[0]) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 10000;
}
export async function calculateRoute(input: QuoteInput) {
  const locations = await Promise.all(input.deliveries.map(async ({ address }) => {
    const search = new URLSearchParams({ text: `${address.street}, ${address.postcode} ${address.city}`, "boundary.country": "DE", layers: "address", size: "3" });
    const parsed = geocodeSchema.safeParse(await routingRequest(`geocode/search?${search}`));
    if (!parsed.success) throw new AppError("Der Adressservice hat eine ungültige Antwort geliefert.", 503);
    const candidates = parsed.data.features.filter(feature => feature.properties.country_a === "DEU"
      && feature.properties.layer === "address"
      && (feature.properties.confidence ?? 0) >= 0.8);
    const exactPostcode = candidates.find(feature => feature.properties.postalcode === address.postcode);
    const withoutPostcode = candidates.filter(feature => !feature.properties.postalcode && matchesAddressWithoutPostcode(feature, address));
    const match = exactPostcode ?? (withoutPostcode.length === 1 ? withoutPostcode[0] : undefined);
    if (!match) {
      console.error("Address lookup did not match", parsed.data.features.map(({ properties }) => ({ country: properties.country_a, postcodeMatches: properties.postalcode === address.postcode, hasPostcode: !!properties.postalcode, layer: properties.layer, confidence: properties.confidence })));
      throw new AppError(`Die Lieferadresse in ${address.postcode} ${address.city} konnte nicht eindeutig gefunden werden. Bitte Straße und Hausnummer prüfen.`);
    }
    const code = match.properties.region_a?.replace(/^DE-/, "");
    const state = STATES.find(state => state === code) ?? regions[match.properties.region ?? ""];
    if (!state) throw new AppError("Das Bundesland der Lieferadresse konnte nicht ermittelt werden. Bitte kontaktieren Sie uns.", 503);
    return { coordinates: match.geometry.coordinates, state, label: match.properties.postalcode ? match.properties.label : `${address.street}, ${address.postcode} ${address.city}` };
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

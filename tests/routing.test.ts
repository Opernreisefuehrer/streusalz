import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateRoute, calculatePostcodeDistance } from "../src/lib/routing";
import { fixture } from "./fixtures";

beforeEach(() => { vi.stubEnv("ORS_API_KEY", "test-only-key"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function mockedRouting(matrix: (number | null)[][], postcode = "55118", confidence = .99) {
  const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const body = String(url).includes("geocode") && options?.method === "GET" ? { features: [{ geometry: { coordinates: [8.25, 50] }, properties: { label: "Teststraße, 55118 Mainz", postalcode: postcode, country_a: "DEU", region_a: "RP", confidence, layer: "address" } }] } : { distances: matrix };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
describe("server-only road route", () => {
  it.each([2009, 2010])("requests a personal offer for a confirmed unrouteable destination (ORS %s)", async code => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code, message: "No routable road" } }, { status: 404 })));
    await expect(calculatePostcodeDistance("27498")).rejects.toMatchObject({ status: 422, code: "manual_quote_required" });
  });
  it.each([401, 403, 429, 500, 503])("keeps provider HTTP %s a service error rather than declaring a manual delivery offer", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 2010 } }, { status })));
    await expect(calculatePostcodeDistance("27498")).rejects.toMatchObject({ status: 503, code: undefined });
  });
  it.each(["Not Found", '{"error":{"code":2003}}'])("does not mistake an invalid endpoint or response for an unrouteable destination: %s", async body => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 404 })));
    await expect(calculatePostcodeDistance("27498")).rejects.toMatchObject({ status: 503, code: undefined });
  });
  it("requests a personal offer when exact delivery coordinates cannot be snapped by the matrix", async () => {
    const fetchMock = mockedRouting([[0, 1000000], [1000000, 0]]);
    const geocode = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, options) => String(url).includes("/matrix/")
      ? Response.json({ error: { code: 6010 } }, { status: 404 }) : geocode(url, options));
    await expect(calculateRoute(fixture().input)).rejects.toMatchObject({ status: 422, code: "manual_quote_required" });
  });
  it.each(["36381", "65719"])("routes postcode %s directly with bounded postcode-only snapping and persistent caching", async postcode => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(url).toContain("/directions/driving-hgv/json");
      const body = JSON.parse(String(options?.body));
      expect(body).toMatchObject({ preference: "recommended", units: "m", geometry: false, radiuses: [350, 5000] });
      if (postcode === "36381") expect(body.coordinates[1]).toEqual([9.5829, 50.3655]);
      return Response.json({ routes: [{ summary: { distance: 1471234 } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(calculatePostcodeDistance(postcode)).resolves.toBe(1471234);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ cache: "force-cache", next: { revalidate: 86400 } });
      expect(String(options?.body)).not.toMatch(/product|tonnes|bigbag/);
    }
  });
  it("preserves directed community distance checks using directions instead of an unavailable matrix", async () => {
    let reverseDistance = 20001;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("geocode")) {
        const text = new URL(url).searchParams.get("text")!;
        const second = text.includes("Second");
        return Response.json({ features: [{ geometry: { coordinates: [second ? 8.3 : 8.2, 50] }, properties: {
          label: text, postalcode: "55118", country_a: "DEU", region_a: "RP", confidence: 1, layer: "address",
        } }] });
      }
      if (url.includes("/matrix/")) return new Response("Unavailable", { status: 503 });
      const { coordinates: [[from], [to]] } = JSON.parse(String(options?.body));
      const distance = from === 23.8787 ? (to === 8.2 ? 1500000 : 1510000) : from === 8.2 ? 19000 : reverseDistance;
      return Response.json({ routes: [{ summary: { distance } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = fixture([12, 11]).input;
    input.deliveries[1].address.street = "Second 1";
    await expect(calculateRoute(input)).rejects.toThrow("20 Straßenkilometer");
    reverseDistance = 20000;
    await expect(calculateRoute(input)).resolves.toMatchObject({ metres: 1519000 });
    const directionsCalls = fetchMock.mock.calls.filter(([url]) => url.includes("/directions/"));
    expect(directionsCalls).toHaveLength(8);
    expect(directionsCalls.every(([, options]) => JSON.parse(String(options?.body)).coordinates[1][0] !== 23.8787)).toBe(true);
    expect(directionsCalls.every(([, options]) => !("radiuses" in JSON.parse(String(options?.body))))).toBe(true);
  });
  it("never substitutes a fabricated distance when both services fail or directions are malformed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"Quota exceeded"}', { status: 403 })));
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("Dies bedeutet nicht, dass Ihre Adresse falsch ist");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/matrix/")
      ? new Response("Unavailable", { status: 503 }) : Response.json({ routes: [{ summary: { distance: -1 } }] })));
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("ungültige Antwort");
  });
  it("accepts a unique exact street and house match near the postcode when the provider omits its postcode", async () => {
    const input = fixture().input;
    input.deliveries[0].address = { street: "Teststraße 39", postcode: "65719", city: "Hofheim" };
    const properties = { label: "Teststraße 39, Hofheim am Taunus", street: "Teststr.", housenumber: "39", localadmin: "Hofheim am Taunus", country_a: "DEU", region_a: "HE", confidence: 1, layer: "address" };
    let features = [{ geometry: { coordinates: [8.4493, 50.0902] }, properties }];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("geocode")
      ? { features } : { distances: [[0, 1500000], [1500000, 0]] }))));
    await expect(calculateRoute(input)).resolves.toMatchObject({ states: ["HE"], labels: ["Teststraße 39, 65719 Hofheim"] });
    for (const change of [{ housenumber: "40" }, { street: "Andere Straße" }, { localadmin: "Frankfurt", locality: "Frankfurt" }, { postalcode: "10115" }, { confidence: .4 }]) {
      features = [{ geometry: { coordinates: [8.4493, 50.0902] }, properties: { ...properties, ...change } }];
      await expect(calculateRoute(input)).rejects.toThrow("eindeutig");
    }
    features = [{ geometry: { coordinates: [13.4, 52.5] }, properties }];
    await expect(calculateRoute(input)).rejects.toThrow("eindeutig");
    features = Array.from({ length: 2 }, () => ({ geometry: { coordinates: [8.4493, 50.0902] }, properties }));
    await expect(calculateRoute(input)).rejects.toThrow("eindeutig");
  });
  it("reports exhausted provider access without incorrectly blaming the address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"Quota exceeded"}', { status: 403 })));
    await expect(calculateRoute(fixture().input)).rejects.toThrow("Dies bedeutet nicht, dass Ihre Adresse falsch ist");
  });
  it("selects the shortest open route across three stops, without a return journey", async () => {
    const mock = mockedRouting([[0, 1500000, 1504000, 1508000], [1500000, 0, 8000, 16000], [1504000, 8000, 0, 8000], [1508000, 16000, 8000, 0]]);
    const route = await calculateRoute(fixture([10, 8, 5]).input);
    expect(route.metres).toBe(1516000);
    expect(route.states).toEqual(["RP", "RP", "RP"]);
    expect(mock).toHaveBeenCalledTimes(4);
    const [, options] = mock.mock.calls.find(call => String(call[0]).includes("matrix"))!;
    expect(options).toBeDefined();
  });
  it("checks the road-distance limit between every pair in both directions", async () => {
    mockedRouting([[0, 1500000, 1510000], [1500000, 0, 19000], [1510000, 20001, 0]]);
    await expect(calculateRoute(fixture([12, 11]).input)).rejects.toThrow("20 Straßenkilometer");
    mockedRouting([[0, 1500000, 1510000], [1500000, 0, 20000], [1510000, 20000, 0]]);
    await expect(calculateRoute(fixture([12, 11]).input)).resolves.toMatchObject({ metres: 1520000 });
  });
  it("fails explicitly for unreachable routes, ambiguous addresses and unavailable configuration", async () => {
    mockedRouting([[0, null], [null, 0]]);
    await expect(calculateRoute(fixture().input)).rejects.toThrow("befahrbare");
    mockedRouting([[0, 1500000], [1500000, 0]], "10115");
    await expect(calculateRoute(fixture().input)).rejects.toThrow("eindeutig");
    mockedRouting([[0, 1500000], [1500000, 0]], "55118", .4);
    await expect(calculateRoute(fixture().input)).rejects.toThrow("eindeutig");
    vi.stubEnv("ORS_API_KEY", "");
    await expect(calculateRoute(fixture().input)).rejects.toThrow("nicht eingerichtet");
  });
});

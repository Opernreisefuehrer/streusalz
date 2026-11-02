import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateRoute } from "../src/lib/routing";
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

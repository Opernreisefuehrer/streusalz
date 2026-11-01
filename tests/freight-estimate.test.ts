import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freightEstimateInputSchema } from "../src/lib/validation";
import { acceptedQuote, createFreightEstimate } from "../src/lib/pricing";
import { calculatePostcodeDistance } from "../src/lib/routing";
import { POST } from "../src/app/api/freight-estimate/route";
import { rateLimit } from "../src/lib/auth";
import { fixture } from "./fixtures";

vi.mock("../src/lib/auth", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, rateLimit: vi.fn() };
});

beforeEach(() => {
  vi.stubEnv("ORS_API_KEY", "test-only-key");
  vi.stubEnv("SESSION_SECRET", "test-only-secret-with-more-than-32-characters");
  vi.stubEnv("SITE_URL", "https://www.streusalz-grosshandel.de");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function mockPostcodeRouting(properties: Record<string, unknown> = {}, distances: (number | null)[][] = [[0, 1500125], [9000000, 0]]) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(
    String(url).includes("geocode") ? {
      features: [{
        geometry: { coordinates: [8.25, 50] },
        properties: { label: "55118 Mainz", name: "55118", postalcode: "55118", country_a: "DEU", layer: "postalcode", ...properties },
      }],
    } : { distances },
  ), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("non-binding postcode freight estimate", () => {
  it("accepts only German postcode format and full 23-tonne truckloads", () => {
    const input = { product: "bigbag", postcode: "01067", tonnes: 23 };
    expect(freightEstimateInputSchema.safeParse(input).success).toBe(true);
    for (const postcode of ["1234", "123456", "ABCDE", " 55118"]) {
      expect(freightEstimateInputSchema.safeParse({ ...input, postcode }).success).toBe(false);
    }
    for (const tonnes of [0, 1, 22, 24, 23.5, Number.MAX_SAFE_INTEGER]) {
      expect(freightEstimateInputSchema.safeParse({ ...input, tonnes }).success).toBe(false);
    }
  });
  it("uses the same one-way freight rate per truck and never issues a binding quote token", async () => {
    const mock = mockPostcodeRouting();
    const one = await createFreightEstimate({ product: "bigbag", postcode: "55118", tonnes: 23 });
    const two = await createFreightEstimate({ product: "bags", postcode: "55118", tonnes: 46 });
    expect(one).toEqual({
      nonBinding: true, postcode: "55118", totalTonnes: 23, trucks: 1,
      goodsCents: 563500, freightCents: 300025, netCents: 863525,
      vatCents: 164070, grossCents: 1027595,
    });
    expect(two.freightCents).toBe(one.freightCents * 2);
    expect(two.goodsCents).toBe(46 * 25500);
    expect(two.grossCents).toBe(two.netCents + two.vatCents);
    expect(Object.keys(two).sort()).toEqual(Object.keys(one).sort());
    expect(one).not.toHaveProperty("token");
    expect(one).not.toHaveProperty("metres");
    expect(JSON.stringify(one)).not.toContain("23.8787");
    expect(() => acceptedQuote(JSON.stringify(one), fixture().input)).toThrow();
    expect(new URL(String(mock.mock.calls[0][0])).searchParams.get("layers")).toBe("postalcode");
  });
  it("matches the exact German postal area, including postcode names when the postcode property is absent", async () => {
    mockPostcodeRouting({ postalcode: undefined });
    await expect(calculatePostcodeDistance("55118")).resolves.toBe(1500125);
    for (const properties of [
      { country_a: "AUT" }, { postalcode: "10115", name: "10115" }, { postalcode: "10115" }, { layer: "address" },
    ]) {
      mockPostcodeRouting(properties);
      await expect(calculatePostcodeDistance("55118")).rejects.toThrow("eindeutig");
    }
  });
  it("rejects unavailable routes, malformed matrices, excessive amounts and missing configuration", async () => {
    mockPostcodeRouting({}, [[0, null], [null, 0]]);
    await expect(calculatePostcodeDistance("55118")).rejects.toThrow("befahrbare");
    mockPostcodeRouting({}, [[0]]);
    await expect(calculatePostcodeDistance("55118")).rejects.toThrow("ungültige Antwort");
    mockPostcodeRouting();
    const tonnes = Number.MAX_SAFE_INTEGER - Number.MAX_SAFE_INTEGER % 23;
    await expect(createFreightEstimate({ product: "bigbag", postcode: "55118", tonnes })).rejects.toThrow("technische Grenze");
    vi.stubEnv("ORS_API_KEY", "");
    await expect(calculatePostcodeDistance("55118")).rejects.toThrow("nicht eingerichtet");
  });
  it("serves only a no-store estimate through the same-origin, rate-limited endpoint", async () => {
    mockPostcodeRouting();
    const request = new Request("https://www.streusalz-grosshandel.de/api/freight-estimate", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify({ product: "bigbag", postcode: "55118", tonnes: 23 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ nonBinding: true, freightCents: 300025 });
    expect(rateLimit).toHaveBeenCalledWith(request, "freight-estimate", 30);
    const rejected = await POST(new Request(request.url, {
      method: "POST", headers: { origin: "https://unrelated.example" },
      body: JSON.stringify({ product: "bigbag", postcode: "55118", tonnes: 23 }),
    }));
    expect(rejected.status).toBe(403);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postcodePriceInputSchema } from "../src/lib/validation";
import { acceptedPostcodePrice, acceptedQuote, createPostcodePrice, createQuote, priceQuote } from "../src/lib/pricing";
import { calculatePostcodeDistance } from "../src/lib/routing";
import { POST } from "../src/app/api/postcode-price/route";
import { POST as quotePOST } from "../src/app/api/quote/route";
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
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

function mockRouting(distances: (number | null)[][] = [[0, 1500125], [9000000, 0]]) {
  const mock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes("geocode")) {
      return Response.json({ features: [{
        geometry: { coordinates: [8.5, 50] },
        properties: { label: "Teststraße, 65719 Hofheim", postalcode: "65719", country_a: "DEU", region_a: "HE", confidence: .99, layer: "address" },
      }] });
    }
    if (!String(url).endsWith("/v2/matrix/driving-hgv") || options?.method !== "POST") throw new Error("Unexpected routing request.");
    return Response.json({ distances });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
const selection = { product: "bigbag", postcode: "65719", tonnes: 23 } as const;
function quoteInput() {
  const input = fixture().input;
  return { ...input, deliveries: [{ tonnes: 23, address: { street: "Teststraße 1", postcode: "65719", city: "Hofheim" } }] };
}
describe("binding postcode prices including delivery", () => {
  it("accepts only German postcode format and full 23-tonne truckloads", () => {
    expect(postcodePriceInputSchema.safeParse({ ...selection, postcode: "01067" }).success).toBe(true);
    for (const postcode of ["1234", "123456", "ABCDE", " 65719"]) {
      expect(postcodePriceInputSchema.safeParse({ ...selection, postcode }).success).toBe(false);
    }
    for (const tonnes of [0, 1, 22, 24, 23.5, Number.MAX_SAFE_INTEGER]) {
      expect(postcodePriceInputSchema.safeParse({ ...selection, tonnes }).success).toBe(false);
    }
  });
  it("combines goods and one-way freight per truck without returning separate customer price components", async () => {
    const mock = mockRouting();
    const one = await createPostcodePrice(selection);
    const two = await createPostcodePrice({ ...selection, product: "bags", tonnes: 46 });
    expect(one.price).toMatchObject({ input: selection, netCents: 863525, vatCents: 164070, grossCents: 1027595 });
    expect(two.price.netCents).toBe(46 * 25500 + 300025 * 2);
    expect(two.price.grossCents).toBe(two.price.netCents + two.price.vatCents);
    expect(Object.keys(one.price).sort()).toEqual(["input", "createdOn", "validUntil", "netCents", "vatCents", "grossCents"].sort());
    expect(acceptedPostcodePrice(one.token, selection)).toEqual(one.price);
    expect(() => acceptedQuote(one.token, quoteInput())).toThrow();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(String(mock.mock.calls[0][0])).toContain("/v2/matrix/driving-hgv");
  });
  it.each(["65719", "01067", "10115", "20095", "55118", "80331"])("resolves %s locally without relying on geocoder postcode coverage", async postcode => {
    const mock = mockRouting();
    await expect(calculatePostcodeDistance(postcode)).resolves.toBe(1500125);
    expect(mock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(payload.locations).toHaveLength(2);
    expect(payload.metrics).toEqual(["distance"]);
    expect(payload.units).toBe("m");
    if (postcode === "65719") expect(payload.locations[1]).toEqual([8.4493, 50.0902]);
  });
  it("keeps the signed all-in postcode price unchanged despite different street distances", async () => {
    mockRouting();
    const initial = await createPostcodePrice(selection);
    const mock = mockRouting([[0, 3000000], [3000000, 0]]);
    const input = quoteInput();
    const result = await createQuote(input, initial.token);
    expect(result.quote.netCents).toBe(initial.price.netCents);
    expect(result.quote.vatCents).toBe(initial.price.vatCents);
    expect(result.quote.grossCents).toBe(initial.price.grossCents);
    expect(result.quote.lines[0]).toMatchObject({ deliveryIncluded: true, state: "HE", resolvedAddress: "Teststraße, 65719 Hofheim" });
    expect(result.quote.netCents).not.toBe(priceQuote(input, { metres: 3000000, states: ["HE"], labels: ["Hofheim"] }).netCents);
    expect(acceptedQuote(result.token, input).grossCents).toBe(initial.price.grossCents);
    expect(mock).toHaveBeenCalledTimes(2);
    const otherStreet = { ...input, deliveries: [{ ...input.deliveries[0], address: { ...input.deliveries[0].address, street: "Andere Straße 9" } }] };
    expect((await createQuote(otherStreet, initial.token)).quote.netCents).toBe(initial.price.netCents);
    expect(() => acceptedQuote(result.token, otherStreet)).toThrow();
  });
  it("rejects tampering and mismatched postcode, product, quantity or community mode", async () => {
    mockRouting();
    const initial = await createPostcodePrice(selection);
    for (const changed of [{ ...selection, postcode: "55118" }, { ...selection, tonnes: 46 }, { ...selection, product: "bags" as const }]) {
      expect(() => acceptedPostcodePrice(initial.token, changed)).toThrow();
    }
    expect(() => acceptedPostcodePrice(`${initial.token.slice(0, -8)}xxxxxxxx`, selection)).toThrow();
    const changed = quoteInput();
    changed.deliveries[0].address.postcode = "55118";
    await expect(createQuote(changed, initial.token)).rejects.toThrow("PLZ");
    await expect(createQuote(fixture([10, 8, 5]).input, initial.token)).rejects.toThrow("Gemeinschaftsbestellung");
  });
  it("does not extend postcode price validity during the final address check and rejects next-day prices", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    mockRouting();
    const initial = await createPostcodePrice(selection);
    vi.advanceTimersByTime(20 * 60 * 1000);
    const final = await createQuote(quoteInput(), initial.token);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(() => acceptedQuote(final.token, quoteInput())).toThrow();
    expect(() => acceptedPostcodePrice(initial.token, selection)).toThrow();
    vi.setSystemTime(new Date("2026-11-02T22:55:00Z"));
    const midnight = await createPostcodePrice(selection);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(() => acceptedPostcodePrice(midnight.token, selection)).toThrow();
  });
  it("still rejects unreachable full delivery addresses even with a valid postcode price", async () => {
    mockRouting();
    const initial = await createPostcodePrice(selection);
    mockRouting([[0, null], [null, 0]]);
    await expect(createQuote(quoteInput(), initial.token)).rejects.toThrow("befahrbare");
  });
  it("preserves the postcode price through the quote API and ignores client-supplied amounts", async () => {
    mockRouting();
    const initial = await createPostcodePrice(selection);
    mockRouting([[0, 3000000], [3000000, 0]]);
    const input = quoteInput();
    const response = await quotePOST(new Request("https://www.streusalz-grosshandel.de/api/quote", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, postcodePriceToken: initial.token, netCents: 1, freightCents: 0 }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quote.netCents).toBe(initial.price.netCents);
    expect(acceptedQuote(body.token, input).grossCents).toBe(initial.price.grossCents);
  });
  it("reports missing postcode coverage explicitly instead of using a different postcode", async () => {
    const mock = mockRouting();
    await expect(calculatePostcodeDistance("00000")).rejects.toThrow("keine Koordinaten");
    expect(mock).not.toHaveBeenCalled();
  });
  it("rejects unavailable routes, malformed matrices, excessive amounts and missing configuration", async () => {
    mockRouting([[0, null], [null, 0]]);
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("befahrbare");
    mockRouting([[0]]);
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("ungültige Antwort");
    mockRouting();
    const tonnes = Number.MAX_SAFE_INTEGER - Number.MAX_SAFE_INTEGER % 23;
    await expect(createPostcodePrice({ ...selection, tonnes })).rejects.toThrow("technische Grenze");
    vi.stubEnv("ORS_API_KEY", "");
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("nicht eingerichtet");
  });
  it("serves only signed all-in prices through the same-origin, rate-limited, no-store endpoint", async () => {
    mockRouting();
    const request = new Request("https://www.streusalz-grosshandel.de/api/postcode-price", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["price", "token"]);
    expect(body.price).toMatchObject({ netCents: 863525, input: selection });
    expect(acceptedPostcodePrice(body.token, selection).netCents).toBe(863525);
    expect(rateLimit).toHaveBeenCalledWith(request, "postcode-price", 30);
    const rejected = await POST(new Request(request.url, {
      method: "POST", headers: { origin: "https://unrelated.example" }, body: JSON.stringify(selection),
    }));
    expect(rejected.status).toBe(403);
  });
});

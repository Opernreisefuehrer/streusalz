import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postcodePriceInputSchema } from "../src/lib/validation";
import { acceptedPostcodePrice, acceptedQuote, createPostcodePrice, createQuote, priceQuote } from "../src/lib/pricing";
import { calculatePostcodeDistance } from "../src/lib/routing";
import { POST } from "../src/app/api/postcode-price/route";
import { POST as quotePOST } from "../src/app/api/quote/route";
import { rateLimit } from "../src/lib/auth";
import { fixture } from "./fixtures";
import germanPostcodes from "../src/lib/data/german-postcodes.json";
import { signToken } from "../src/lib/tokens";

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
    if (options?.method !== "POST") throw new Error("Unexpected routing request.");
    if (String(url).endsWith("/v2/matrix/driving-hgv")) return Response.json({ distances });
    if (String(url).endsWith("/v2/directions/driving-hgv/json")) return Response.json({ routes: [{ summary: { distance: distances[0]?.[1] } }] });
    throw new Error("Unexpected routing request.");
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
  it.each(["27498", "27499"])("returns an explicit personal-offer result for an unrouteable postcode %s, never a fake price or an outage", async postcode => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 2010, message: "No routable point" } }, { status: 404 })));
    const response = await POST(new Request("https://www.streusalz-grosshandel.de/api/postcode-price", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify({ ...selection, postcode }),
    }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("manual_quote_required");
    expect(body.error).toContain("individuelles Lieferangebot");
    expect(body.error).not.toContain("Service");
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("token");
  });
  it("contains valid reference coordinates for every bundled German postcode", () => {
    const entries = Object.entries(germanPostcodes.postcodes);
    expect(entries.length).toBeGreaterThan(8000);
    for (const [postcode, coordinates] of entries) {
      expect(postcode, postcode).toMatch(/^\d{5}$/);
      expect(coordinates, postcode).toHaveLength(2);
      expect(coordinates.every(Number.isFinite), postcode).toBe(true);
      expect(coordinates[0], postcode).toBeGreaterThanOrEqual(5);
      expect(coordinates[0], postcode).toBeLessThanOrEqual(16);
      expect(coordinates[1], postcode).toBeGreaterThanOrEqual(47);
      expect(coordinates[1], postcode).toBeLessThanOrEqual(56);
    }
  });
  it.each([
    { product: "bigbag" as const, tonnes: 23 },
    { product: "bags" as const, tonnes: 23 },
    { product: "bigbag" as const, tonnes: 46 },
    { product: "bigbag" as const, tonnes: 46, items: [{ product: "bigbag" as const, tonnes: 23 }, { product: "bags" as const, tonnes: 23 }] },
  ])("calculates and signs prices for every bundled postcode with simulated routes: %j", async configuration => {
    const mock = mockRouting();
    const entries = Object.entries(germanPostcodes.postcodes);
    const expectedNet = (configuration.items ?? [{ product: configuration.product, tonnes: configuration.tonnes }])
      .reduce((sum, item) => sum + item.tonnes * (item.product === "bigbag" ? 15300 : 16900), 0)
      + 300025 * (configuration.tonnes / 23);
    for (const [postcode, coordinates] of entries) {
      const input = { ...configuration, postcode };
      const result = await createPostcodePrice(input);
      expect(result.price.netCents, postcode).toBe(expectedNet);
      expect(result.price.vatCents, postcode).toBe(Math.round(expectedNet * .19));
      expect(result.price.grossCents, postcode).toBe(result.price.netCents + result.price.vatCents);
      expect(acceptedPostcodePrice(result.token, input), postcode).toEqual(result.price);
      if (result.price.items) expect(result.price.items.reduce((sum, item) => sum + item.netCents, 0), postcode).toBe(expectedNet);
      const call = mock.mock.calls.at(-1)!;
      const request = JSON.parse(String(call[1]?.body));
      expect(request.coordinates[1], postcode).toEqual(coordinates);
      expect(request.radiuses, postcode).toEqual([350, 5000]);
    }
    expect(mock).toHaveBeenCalledTimes(entries.length);
  });
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
    expect(one.price).toMatchObject({ input: selection, netCents: 651925, vatCents: 123866, grossCents: 775791 });
    expect(two.price.netCents).toBe(46 * 16900 + 300025 * 2);
    expect(two.price.grossCents).toBe(two.price.netCents + two.price.vatCents);
    expect(Object.keys(one.price).sort()).toEqual(["input", "createdOn", "validUntil", "netCents", "vatCents", "grossCents"].sort());
    expect(acceptedPostcodePrice(one.token, selection)).toEqual(one.price);
    expect(() => acceptedQuote(one.token, quoteInput())).toThrow();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(String(mock.mock.calls[0][0])).toContain("/v2/directions/driving-hgv/json");
  });
  it.each(["36381", "65719", "01067", "10115", "20095", "55118", "80331"])("resolves %s locally without relying on geocoder postcode coverage", async postcode => {
    const mock = mockRouting();
    await expect(calculatePostcodeDistance(postcode)).resolves.toBe(1500125);
    expect(mock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(payload.coordinates).toHaveLength(2);
    expect(payload.radiuses).toEqual([350, 5000]);
    expect(payload.units).toBe("m");
    if (postcode === "65719") expect(payload.coordinates[1]).toEqual([8.4493, 50.0902]);
    if (postcode === "36381") expect(payload.coordinates[1]).toEqual([9.5829, 50.3655]);
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
  it("locks mixed full-truck item prices and their sum through the final quote API", async () => {
    mockRouting();
    const items = [{ product: "bigbag" as const, tonnes: 23 }, { product: "bags" as const, tonnes: 23 }];
    const selected = { ...selection, tonnes: 46, items };
    const initial = await createPostcodePrice(selected);
    expect(initial.price.netCents).toBe(1340650);
    expect(initial.price.items).toEqual([{ ...items[0], netCents: 651925 }, { ...items[1], netCents: 688725 }]);
    mockRouting([[0, 3000000], [3000000, 0]]);
    const input = { ...quoteInput(), items, deliveries: [{ ...quoteInput().deliveries[0], tonnes: 46 }] };
    const response = await quotePOST(new Request("https://www.streusalz-grosshandel.de/api/quote", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, postcodePriceToken: initial.token }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quote.netCents).toBe(initial.price.netCents);
    expect(body.quote.items).toEqual(initial.price.items);
    expect(acceptedQuote(body.token, input).lines).toHaveLength(1);
    const larger = { ...selected, tonnes: 69, items: [{ product: "bigbag" as const, tonnes: 46 }, { product: "bags" as const, tonnes: 23 }] };
    const locked = await createPostcodePrice(larger);
    const swapped = { ...larger, items: [{ product: "bigbag" as const, tonnes: 23 }, { product: "bags" as const, tonnes: 46 }] };
    expect(() => acceptedPostcodePrice(locked.token, swapped)).toThrow();
    expect(() => acceptedQuote(body.token, { ...input, items: undefined })).toThrow();
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
  it("preserves still-valid mixed line prices issued before a goods-price change", async () => {
    mockRouting();
    const items = [{ product: "bigbag" as const, tonnes: 23 }, { product: "bags" as const, tonnes: 23 }];
    const initial = await createPostcodePrice({ ...selection, tonnes: 46, items });
    const previousPrice = {
      ...initial.price, netCents: 1750050, vatCents: 332510, grossCents: 2082560,
      items: [{ ...items[0], netCents: 863525 }, { ...items[1], netCents: 886525 }],
    };
    const token = signToken("postcode-price", previousPrice, 1800);
    const input = { ...quoteInput(), items, deliveries: [{ ...quoteInput().deliveries[0], tonnes: 46 }] };
    const final = await createQuote(input, token);
    expect(final.quote.netCents).toBe(previousPrice.netCents);
    expect(final.quote.vatCents).toBe(previousPrice.vatCents);
    expect(final.quote.grossCents).toBe(previousPrice.grossCents);
    expect(final.quote.items).toEqual(previousPrice.items);
    expect(acceptedQuote(final.token, input).items).toEqual(previousPrice.items);
    expect(initial.price.netCents).toBe(1340650);
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
  it("rejects unusable routes, malformed directions, excessive amounts and missing configuration", async () => {
    mockRouting([[0, 0], [0, 0]]);
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("befahrbare");
    mockRouting([[0]]);
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("ungültige Antwort");
    mockRouting();
    const tonnes = Number.MAX_SAFE_INTEGER - Number.MAX_SAFE_INTEGER % 23;
    await expect(createPostcodePrice({ ...selection, tonnes })).rejects.toThrow("technische Grenze");
    vi.stubEnv("ORS_API_KEY", "");
    await expect(calculatePostcodeDistance("65719")).rejects.toThrow("nicht eingerichtet");
  });
  it("returns a signed price for 36381 when its postcode point cannot snap within the old 350-metre limit", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      expect(String(url)).toContain("/directions/driving-hgv/json");
      const body = JSON.parse(String(options?.body));
      if (body.radiuses?.[1] !== 5000) return Response.json({ error: { code: 2010, message: "Could not find routable point within a radius of 350.0 meters." } }, { status: 404 });
      expect(body.coordinates[1]).toEqual([9.5829, 50.3655]);
      return Response.json({ routes: [{ summary: { distance: 1500125 } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = { ...selection, postcode: "36381" };
    const response = await POST(new Request("https://www.streusalz-grosshandel.de/api/postcode-price", {
      method: "POST", headers: { origin: "https://www.streusalz-grosshandel.de", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(acceptedPostcodePrice(body.token, input).netCents).toBe(651925);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(body.price).toMatchObject({ netCents: 651925, input: selection });
    expect(acceptedPostcodePrice(body.token, selection).netCents).toBe(651925);
    expect(rateLimit).toHaveBeenCalledWith(request, "postcode-price", 30);
    const rejected = await POST(new Request(request.url, {
      method: "POST", headers: { origin: "https://unrelated.example" }, body: JSON.stringify(selection),
    }));
    expect(rejected.status).toBe(403);
  });
});

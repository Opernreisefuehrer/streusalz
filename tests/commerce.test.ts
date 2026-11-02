import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { quoteInputSchema, orderInputSchema, quoteInputFromOrder, postcodePriceInputSchema } from "../src/lib/validation";
import { priceQuote, proportionalShares, acceptedQuote } from "../src/lib/pricing";
import { addWorkingDays, berlinDate, dueDate } from "../src/lib/delivery-date";
import { signToken, verifyToken } from "../src/lib/tokens";
import { fixture } from "./fixtures";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("B2B quantities and pricing", () => {
  it("allows only full tonnes and 23-tonne steps without an arbitrary truck cap", () => {
    for (const weights of [[23], [46], [10, 8, 5], [230], [253], [2300]]) expect(quoteInputSchema.safeParse(fixture(weights).input).success).toBe(true);
    const input = fixture().input;
    for (const tonnes of [1, 22, 24, 23.5, Number.MAX_SAFE_INTEGER]) expect(quoteInputSchema.safeParse({ ...input, deliveries: [{ ...input.deliveries[0], tonnes }] }).success).toBe(false);
    expect(quoteInputSchema.safeParse({ ...input, product: "mixed" }).success).toBe(false);
    expect(quoteInputSchema.safeParse({ ...input, deliveries: Array(4).fill(input.deliveries[0]) }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...fixture().order, businessAccepted: false }).success).toBe(false);
  });
  it("charges each 23-tonne truck for one-way road distance at 2 euros/km", () => {
    const one = fixture([23]).quote, two = fixture([46]).quote;
    expect(one.freightCents).toBe(300025);
    expect(two.freightCents).toBe(one.freightCents * 2);
    expect(one.goodsCents).toBe(23 * 16900);
    const { input } = fixture();
    const bags = priceQuote({ ...input, product: "bags" }, { metres: 1500000, states: ["RP"], labels: ["Mainz"] });
    expect(bags.goodsCents).toBe(23 * 15300);
  });
  it("allows different full-truck products in one order but only one shared truck for communities", () => {
    const items = [{ product: "bigbag" as const, tonnes: 23 }, { product: "bags" as const, tonnes: 23 }];
    const { input, order } = fixture([46]);
    const mixed = { ...input, items };
    expect(quoteInputSchema.safeParse(mixed).success).toBe(true);
    expect(quoteInputFromOrder({ ...order, items })).toEqual(mixed);
    const quote = priceQuote(mixed, { metres: 1500125, states: ["RP"], labels: ["Mainz"] });
    expect(quote.goodsCents).toBe(23 * 16900 + 23 * 15300);
    expect(quote.freightCents).toBe(600050);
    expect(quote.netCents).toBe(1340650);
    expect(quote.lines).toHaveLength(1);
    expect(quote.items?.map(item => item.netCents)).toEqual([688725, 651925]);
    expect(quote.items?.reduce((sum, item) => sum + item.netCents, 0)).toBe(quote.netCents);
    const shared = fixture([10, 8, 5]).input;
    expect(quoteInputSchema.safeParse({ ...shared, items }).success).toBe(false);
    expect(quoteInputSchema.safeParse({ ...shared, deliveries: shared.deliveries.map(delivery => ({ ...delivery, tonnes: delivery.tonnes * 2 })) }).success).toBe(false);
    for (const badItems of [
      [{ product: "bigbag", tonnes: 22 }, { product: "bags", tonnes: 24 }],
      [{ product: "bigbag", tonnes: 23 }, { product: "bigbag", tonnes: 23 }],
      [{ product: "bigbag", tonnes: 46 }, { product: "bags", tonnes: 23 }],
    ]) {
      expect(postcodePriceInputSchema.safeParse({ product: "bigbag", postcode: "65719", tonnes: 46, items: badItems }).success).toBe(false);
    }
  });
  it("allows municipalities without VAT IDs and mixed business/public community orders with eligibility confirmation", () => {
    const municipal = fixture().order;
    municipal.participants[0].company = "Gemeinde Musterhausen";
    municipal.participants[0].vatId = "";
    expect(orderInputSchema.parse(municipal).participants[0].company).toBe("Gemeinde Musterhausen");
    const mixed = fixture([10, 8, 5]).order;
    mixed.participants[1].company = "Gemeinde Musterhausen";
    mixed.participants[1].vatId = "";
    mixed.participants[2].company = "Stadt Beispielstadt";
    expect(orderInputSchema.safeParse(mixed).success).toBe(true);
    const unconfirmed = orderInputSchema.safeParse({ ...municipal, businessAccepted: false });
    expect(unconfirmed.success).toBe(false);
    if (!unconfirmed.success) expect(unconfirmed.error.issues[0].message).toContain("öffentliche Auftraggeber");
  });
  it("allocates cents by tonne share, preserving sums on separate invoices including VAT", () => {
    expect(proportionalShares(100, [1, 1, 1])).toEqual([34, 33, 33]);
    const largeShares = proportionalShares(Number.MAX_SAFE_INTEGER, [23, 46]);
    expect(largeShares.reduce((sum, value) => sum + value, 0)).toBe(Number.MAX_SAFE_INTEGER);
    expect(largeShares[0]).toBe(Number((BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)) / BigInt(3)));
    const { quote } = fixture([10, 8, 5]);
    expect(quote.lines.map(line => line.freightCents)).toEqual(proportionalShares(quote.freightCents, [10, 8, 5]));
    for (const key of ["freightCents", "goodsCents", "netCents", "vatCents", "grossCents"] as const) expect(quote.lines.reduce((sum, line) => sum + line[key], 0)).toBe(quote[key]);
    for (const line of quote.lines) expect(line.vatCents).toBe(Math.round(line.netCents * .19));
  });
});
describe("calendar", () => {
  it("excludes weekends, starts after ordering and respects state public holidays", () => {
    expect(addWorkingDays("2026-11-01", "RP")).toBe("2026-11-06");
    expect(addWorkingDays("2026-12-23", "RP")).toBe("2026-12-31");
    expect(addWorkingDays("2026-12-24", "RP")).toBe("2027-01-04");
    expect(addWorkingDays("2026-06-01", "RP")).toBe("2026-06-09");
    expect(addWorkingDays("2026-06-01", "BE")).toBe("2026-06-08");
    expect(berlinDate(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
    expect(dueDate("2026-12-25")).toBe("2027-01-08");
  });
});
describe("signed server-side quotes", () => {
  it("rejects tampering, expired quotes, mismatched inputs and next-day checkout", () => {
    vi.stubEnv("SESSION_SECRET", "test-only-secret-with-more-than-32-characters");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const { quote, input } = fixture();
    const token = signToken("quote", quote, 1800);
    expect(acceptedQuote(token, input)).toEqual(quote);
    expect(() => acceptedQuote(`${token.slice(0, -8)}xxxxxxxx`, input)).toThrow();
    expect(() => acceptedQuote(token, { ...input, product: "bags" })).toThrow();
    expect(() => verifyToken(token, "admin", z.unknown())).toThrow();
    vi.advanceTimersByTime(1800001);
    expect(() => acceptedQuote(token, input)).toThrow();
    vi.setSystemTime(new Date("2026-11-01T22:55:00Z"));
    const nearMidnight = fixture();
    const midnightToken = signToken("quote", nearMidnight.quote, 1800);
    vi.advanceTimersByTime(600000);
    expect(() => acceptedQuote(midnightToken, nearMidnight.input)).toThrow();
  });
});

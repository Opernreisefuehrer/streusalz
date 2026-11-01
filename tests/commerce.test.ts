import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { quoteInputSchema, orderInputSchema } from "../src/lib/validation";
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
    expect(one.goodsCents).toBe(23 * 24500);
    const { input } = fixture();
    const bags = priceQuote({ ...input, product: "bags" }, { metres: 1500000, states: ["RP"], labels: ["Mainz"] });
    expect(bags.goodsCents).toBe(23 * 25500);
  });
  it("allocates cents by tonne share, preserving sums on separate invoices including VAT", () => {
    expect(proportionalShares(100, [1, 1, 1])).toEqual([34, 33, 33]);
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

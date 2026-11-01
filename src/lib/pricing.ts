import "server-only";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { PRODUCTS, TRUCK_TONNES } from "./catalog";
import { addWorkingDays, berlinDate, STATES } from "./delivery-date";
import { freightEstimateInputSchema, quoteInputSchema, type FreightEstimateInput, type QuoteInput } from "./validation";
import { calculatePostcodeDistance, calculateRoute } from "./routing";
import { signToken, verifyToken } from "./tokens";
import { AppError } from "./errors";

const lineSchema = z.object({
  tonnes: z.number().int().positive(),
  goodsCents: z.number().int().nonnegative(),
  freightCents: z.number().int().nonnegative(),
  netCents: z.number().int().nonnegative(),
  vatCents: z.number().int().nonnegative(),
  grossCents: z.number().int().nonnegative(),
  deliveryDate: z.string(),
  resolvedAddress: z.string(),
  state: z.enum(STATES),
});
export const quoteSchema = z.object({
  input: quoteInputSchema,
  createdOn: z.string(),
  totalTonnes: z.number().int(),
  trucks: z.number().int(),
  goodsCents: z.number().int(),
  freightCents: z.number().int(),
  netCents: z.number().int(),
  vatCents: z.number().int(),
  grossCents: z.number().int(),
  lines: z.array(lineSchema),
});
export type Quote = z.infer<typeof quoteSchema>;
export type FreightEstimate = {
  nonBinding: true;
  postcode: string;
  totalTonnes: number;
  trucks: number;
  goodsCents: number;
  freightCents: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
};

function roadFreightCents(metres: number, trucks: number) {
  return Math.round(metres / 1000 * 200) * trucks;
}
export async function createFreightEstimate(input: FreightEstimateInput): Promise<FreightEstimate> {
  input = freightEstimateInputSchema.parse(input);
  const trucks = input.tonnes / TRUCK_TONNES;
  const freightCents = roadFreightCents(await calculatePostcodeDistance(input.postcode), trucks);
  const goodsCents = input.tonnes * PRODUCTS[input.product].priceCents;
  const netCents = goodsCents + freightCents;
  const vatCents = Math.round(netCents * 19 / 100);
  const grossCents = netCents + vatCents;
  if (![freightCents, goodsCents, netCents, vatCents, grossCents].every(Number.isSafeInteger)) {
    throw new AppError("Diese Menge überschreitet die technische Grenze der Online-Preisberechnung. Bitte kontaktieren Sie uns.");
  }
  return { nonBinding: true, postcode: input.postcode, totalTonnes: input.tonnes, trucks, goodsCents, freightCents, netCents, vatCents, grossCents };
}
export function proportionalShares(totalCents: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map(weight => Math.floor(totalCents * weight / totalWeight));
  let remainder = totalCents - shares.reduce((sum, share) => sum + share, 0);
  const ranked = weights.map((weight, index) => ({ index, fraction: totalCents * weight / totalWeight - shares[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of ranked) {
    if (remainder-- <= 0) break;
    shares[index]++;
  }
  return shares;
}
export function priceQuote(input: QuoteInput, route: Awaited<ReturnType<typeof calculateRoute>>, now = new Date()): Quote {
  input = quoteInputSchema.parse(input);
  const totalTonnes = input.deliveries.reduce((sum, delivery) => sum + delivery.tonnes, 0);
  const trucks = totalTonnes / TRUCK_TONNES;
  const freightCents = roadFreightCents(route.metres, trucks);
  if (!Number.isSafeInteger(freightCents) || !Number.isSafeInteger(totalTonnes * PRODUCTS[input.product].priceCents + freightCents)) {
    throw new AppError("Diese Menge überschreitet die technische Grenze der Online-Preisberechnung. Bitte kontaktieren Sie uns.");
  }
  const freightShares = proportionalShares(freightCents, input.deliveries.map(delivery => delivery.tonnes));
  const createdOn = berlinDate(now);
  const lines = input.deliveries.map((delivery, index) => {
    const goodsCents = delivery.tonnes * PRODUCTS[input.product].priceCents;
    const netCents = goodsCents + freightShares[index];
    const vatCents = Math.round(netCents * 19 / 100);
    return {
      tonnes: delivery.tonnes, goodsCents, freightCents: freightShares[index], netCents, vatCents,
      grossCents: netCents + vatCents,
      deliveryDate: addWorkingDays(createdOn, route.states[index]), resolvedAddress: route.labels[index], state: route.states[index],
    };
  });
  const sum = (key: "goodsCents" | "netCents" | "vatCents" | "grossCents") => lines.reduce((sum, line) => sum + line[key], 0);
  return { input, createdOn, totalTonnes, trucks, freightCents, goodsCents: sum("goodsCents"), netCents: sum("netCents"), vatCents: sum("vatCents"), grossCents: sum("grossCents"), lines };
}
export async function createQuote(input: QuoteInput) {
  const quote = priceQuote(input, await calculateRoute(input));
  return { quote, token: signToken("quote", quote, 30 * 60) };
}
export function acceptedQuote(token: string, input: QuoteInput) {
  const quote = verifyToken(token, "quote", quoteSchema);
  if (!isDeepStrictEqual(input, quote.input) || quote.createdOn !== berlinDate()) {
    throw new AppError("Menge, Adresse oder Bestelltag hat sich geändert. Bitte Lieferkosten neu berechnen.");
  }
  return quote;
}

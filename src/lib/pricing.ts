import "server-only";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { PRODUCTS, TRUCK_TONNES, type LoadItem, type Product } from "./catalog";
import { addWorkingDays, berlinDate, STATES } from "./delivery-date";
import { postcodePriceInputSchema, quoteInputSchema, type PostcodePriceInput, type QuoteInput } from "./validation";
import { calculatePostcodeDistance, calculateRoute } from "./routing";
import { signToken, verifyToken } from "./tokens";
import { AppError } from "./errors";

const lineSchema = z.object({
  deliveryIncluded: z.literal(true).optional(),
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
const pricedItemsSchema = z.array(z.object({ product: z.enum(["bigbag", "bags"]), tonnes: z.number().int().positive(), netCents: z.number().int().nonnegative() }));
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
  items: pricedItemsSchema.optional(),
});
export type Quote = z.infer<typeof quoteSchema>;
export const postcodePriceSchema = z.object({
  input: postcodePriceInputSchema,
  createdOn: z.string(),
  validUntil: z.number().int(),
  netCents: z.number().int().nonnegative(),
  vatCents: z.number().int().nonnegative(),
  grossCents: z.number().int().nonnegative(),
  items: pricedItemsSchema.optional(),
});
export type PostcodePrice = z.infer<typeof postcodePriceSchema>;

function roadFreightCents(metres: number, trucks: number) {
  return Math.round(metres / 1000 * 200) * trucks;
}
function goodsPrice(product: Product, tonnes: number, items?: LoadItem[]) {
  return (items ?? [{ product, tonnes }]).reduce((sum, item) => sum + item.tonnes * PRODUCTS[item.product].priceCents, 0);
}
function itemPrices(items: LoadItem[], freightCents: number) {
  const shares = proportionalShares(freightCents, items.map(item => item.tonnes));
  return items.map((item, index) => ({ ...item, netCents: item.tonnes * PRODUCTS[item.product].priceCents + shares[index] }));
}
export async function createPostcodePrice(input: PostcodePriceInput) {
  input = postcodePriceInputSchema.parse(input);
  const trucks = input.tonnes / TRUCK_TONNES;
  const freightCents = roadFreightCents(await calculatePostcodeDistance(input.postcode), trucks);
  const goodsCents = goodsPrice(input.product, input.tonnes, input.items);
  const netCents = goodsCents + freightCents;
  const vatCents = Math.round(netCents * 19 / 100);
  const grossCents = netCents + vatCents;
  if (![freightCents, goodsCents, netCents, vatCents, grossCents].every(Number.isSafeInteger)) {
    throw new AppError("Diese Menge überschreitet die technische Grenze der Online-Preisberechnung. Bitte kontaktieren Sie uns.");
  }
  const price: PostcodePrice = { input, createdOn: berlinDate(), validUntil: Date.now() + 30 * 60 * 1000, netCents, vatCents, grossCents, ...(input.items ? { items: itemPrices(input.items, freightCents) } : {}) };
  return { price, token: signToken("postcode-price", price, 30 * 60) };
}
export function acceptedPostcodePrice(token: string, input: PostcodePriceInput) {
  const price = verifyToken(token, "postcode-price", postcodePriceSchema);
  if (!isDeepStrictEqual(input, price.input) || price.createdOn !== berlinDate() || price.validUntil <= Date.now()) {
    throw new AppError("PLZ, Menge, Gebinde oder Preisgültigkeit hat sich geändert. Bitte den aktuellen Preis erneut abrufen.");
  }
  return price;
}
export function proportionalShares(totalCents: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const divisor = BigInt(totalWeight);
  const parts = weights.map(weight => {
    const numerator = BigInt(totalCents) * BigInt(weight);
    return { share: Number(numerator / divisor), fraction: Number(numerator % divisor) };
  });
  const shares = parts.map(part => part.share);
  let remainder = totalCents - shares.reduce((sum, share) => sum + share, 0);
  const ranked = parts.map((part, index) => ({ index, fraction: part.fraction }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of ranked) {
    if (remainder-- <= 0) break;
    shares[index]++;
  }
  return shares;
}
export function priceQuote(input: QuoteInput, route: Awaited<ReturnType<typeof calculateRoute>>, now = new Date(), fixedFreightCents?: number): Quote {
  input = quoteInputSchema.parse(input);
  const totalTonnes = input.deliveries.reduce((sum, delivery) => sum + delivery.tonnes, 0);
  const trucks = totalTonnes / TRUCK_TONNES;
  const freightCents = fixedFreightCents ?? roadFreightCents(route.metres, trucks);
  if (!Number.isSafeInteger(freightCents) || freightCents < 0 || !Number.isSafeInteger(goodsPrice(input.product, totalTonnes, input.items) + freightCents)) {
    throw new AppError("Diese Menge überschreitet die technische Grenze der Online-Preisberechnung. Bitte kontaktieren Sie uns.");
  }
  const freightShares = proportionalShares(freightCents, input.deliveries.map(delivery => delivery.tonnes));
  const createdOn = berlinDate(now);
  const lines = input.deliveries.map((delivery, index) => {
    const goodsCents = goodsPrice(input.product, delivery.tonnes, input.items);
    const netCents = goodsCents + freightShares[index];
    const vatCents = Math.round(netCents * 19 / 100);
    return {
      deliveryIncluded: true as const, tonnes: delivery.tonnes, goodsCents, freightCents: freightShares[index], netCents, vatCents,
      grossCents: netCents + vatCents,
      deliveryDate: addWorkingDays(createdOn, route.states[index]), resolvedAddress: route.labels[index], state: route.states[index],
    };
  });
  const sum = (key: "goodsCents" | "netCents" | "vatCents" | "grossCents") => lines.reduce((sum, line) => sum + line[key], 0);
  return { input, createdOn, totalTonnes, trucks, freightCents, goodsCents: sum("goodsCents"), netCents: sum("netCents"), vatCents: sum("vatCents"), grossCents: sum("grossCents"), lines, ...(input.items ? { items: itemPrices(input.items, freightCents) } : {}) };
}
export async function createQuote(input: QuoteInput, postcodePriceToken?: string) {
  input = quoteInputSchema.parse(input);
  let price: PostcodePrice | undefined;
  if (input.deliveries.length === 1) {
    const selection = { product: input.product, postcode: input.deliveries[0].address.postcode, tonnes: input.deliveries[0].tonnes, ...(input.items ? { items: input.items } : {}) };
    price = postcodePriceToken ? acceptedPostcodePrice(postcodePriceToken, selection) : (await createPostcodePrice(selection)).price;
  } else if (postcodePriceToken) {
    throw new AppError("Für eine Gemeinschaftsbestellung bitte den Gesamtpreis mit allen Lieferadressen neu berechnen.");
  }
  const route = await calculateRoute(input);
  if (price && (price.validUntil <= Date.now() || price.createdOn !== berlinDate())) {
    throw new AppError("Der angezeigte Preis ist abgelaufen. Bitte den aktuellen Preis erneut abrufen.");
  }
  const fixedFreightCents = price ? price.netCents - goodsPrice(input.product, price.input.tonnes, input.items) : undefined;
  const quote = priceQuote(input, route, new Date(), fixedFreightCents);
  return { quote, token: signToken("quote", quote, price ? (price.validUntil - Date.now()) / 1000 : 30 * 60) };
}
export function acceptedQuote(token: string, input: QuoteInput) {
  const quote = verifyToken(token, "quote", quoteSchema);
  if (!isDeepStrictEqual(input, quote.input) || quote.createdOn !== berlinDate()) {
    throw new AppError("Menge, Adresse oder Bestelltag hat sich geändert. Bitte den Gesamtpreis erneut bestätigen.");
  }
  return quote;
}

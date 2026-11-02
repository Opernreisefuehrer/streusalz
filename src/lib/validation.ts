import { z } from "zod";

const text = z.string().trim().min(1, "Bitte ausfüllen.").max(160);
export const postcodeSchema = z.string().regex(/^\d{5}$/, "Bitte eine deutsche, fünfstellige Postleitzahl angeben.");
export const addressSchema = z.object({
  street: text,
  postcode: postcodeSchema,
  city: text,
});
export const postcodePriceInputSchema = z.object({
  product: z.enum(["bigbag", "bags"]),
  postcode: postcodeSchema,
  tonnes: z.number().int().min(23).refine(value => Number.isSafeInteger(value) && value % 23 === 0, "Die Menge muss 23, 46, 69 … Tonnen ergeben."),
});
export type PostcodePriceInput = z.infer<typeof postcodePriceInputSchema>;
export const participantSchema = z.object({
  company: text,
  contact: text,
  email: z.email("Bitte eine gültige E-Mail-Adresse angeben.").max(254),
  phone: z.string().trim().min(5).max(40),
  vatId: z.string().trim().max(30),
  tonnes: z.number().int().min(1),
  address: addressSchema,
  billingAddress: addressSchema,
});
export const quoteInputSchema = z.object({
  product: z.enum(["bigbag", "bags"]),
  deliveries: z.array(z.object({ tonnes: z.number().int().min(1), address: addressSchema })).min(1).max(3),
}).superRefine((input, context) => {
  const total = input.deliveries.reduce((sum, delivery) => sum + delivery.tonnes, 0);
  if (!Number.isSafeInteger(total) || total % 23 !== 0) {
    context.addIssue({ code: "custom", message: "Die Gesamtmenge muss volle 23-Tonnen-Ladungen ergeben: 23, 46, 69 … Tonnen.", path: ["deliveries"] });
  }
});
export const quoteRequestSchema = quoteInputSchema.and(z.object({
  postcodePriceToken: z.string().min(10).max(4000).optional(),
}));
export const orderInputSchema = z.object({
  quoteToken: z.string().min(10).max(12000),
  requestId: z.uuid(),
  legalVersion: z.string().regex(/^[a-f0-9]{64}$/, "Die Fassung der Vertragsbedingungen ist ungültig. Bitte laden Sie das Bestellformular neu."),
  product: z.enum(["bigbag", "bags"]),
  participants: z.array(participantSchema).min(1).max(3),
  businessAccepted: z.literal(true, { error: "Bestellungen sind ausschließlich für Gewerbetreibende und öffentliche Auftraggeber. Kein Verkauf an Privatkunden." }),
  termsAccepted: z.literal(true, { error: "Bitte die AGB bestätigen." }),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export function quoteInputFromOrder(order: OrderInput): QuoteInput {
  return quoteInputSchema.parse({
    product: order.product,
    deliveries: order.participants.map(({ tonnes, address }) => ({ tonnes, address })),
  });
}

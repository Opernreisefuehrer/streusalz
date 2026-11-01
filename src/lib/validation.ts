import { z } from "zod";

const text = z.string().trim().min(1, "Bitte ausfüllen.").max(160);
export const addressSchema = z.object({
  street: text,
  postcode: z.string().regex(/^\d{5}$/, "Bitte eine deutsche, fünfstellige Postleitzahl angeben."),
  city: text,
});
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
export const orderInputSchema = z.object({
  quoteToken: z.string().min(10).max(12000),
  requestId: z.uuid(),
  product: z.enum(["bigbag", "bags"]),
  participants: z.array(participantSchema).min(1).max(3),
  businessAccepted: z.literal(true, { error: "Bestellungen sind ausschließlich für Gewerbetreibende." }),
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

import type { Participant, OrderInput, QuoteInput } from "../src/lib/validation";
import { priceQuote } from "../src/lib/pricing";
import type { State } from "../src/lib/delivery-date";
import { randomUUID } from "node:crypto";
import { legalTexts } from "../src/lib/legal";

export function participant(tonnes: number, index = 0): Participant {
  return { tonnes, company: `Winterdienst ${index + 1} GmbH`, contact: "Müller", email: `company${index}@example.invalid`, phone: "06131123456", vatId: "", address: { street: `Teststraße ${index + 1}`, postcode: "55118", city: "Mainz" }, billingAddress: { street: "Bürostraße 1", postcode: "55118", city: "Mainz" } };
}
export function fixture(weights = [23], now = new Date()) {
  const participants = weights.map(participant);
  const input: QuoteInput = { product: "bigbag", deliveries: participants.map(({ tonnes, address }) => ({ tonnes, address })) };
  const quote = priceQuote(input, { metres: 1500123, states: weights.map((): State => "RP"), labels: participants.map(p => `${p.address.street}, Mainz`) }, now);
  const order: OrderInput = { product: input.product, participants, quoteToken: "unused-token-in-service-test", requestId: randomUUID(), legalVersion: legalTexts().version, businessAccepted: true, termsAccepted: true };
  return { input, quote, order };
}

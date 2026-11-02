import { it } from "vitest";
import { writeFile } from "node:fs/promises";
import { buildPdf } from "../src/lib/pdf";
import { seller } from "../src/lib/config";
import { fixture } from "./fixtures";

it("exports an invoice preview with synthetic data only", async () => {
  const { order, quote } = fixture();
  const pdf = await buildPdf({
    id: "preview", order_id: "preview", participant_index: 0, kind: "invoice",
    number: "R-MUSTER-2026", created_at: new Date(),
    snapshot: {
      seller: { ...seller(), name: "Musterhandel", street: "Musterweg 1", postcode: "12345", city: "Musterstadt", email: "info@example.invalid", taxId: "DE123456789", bankName: "Musterbank", iban: "DE00 0000 0000 0000 0000 00", bic: "TESTDE00" },
      participant: order.participants[0], product: order.product, line: quote.lines[0],
      issueDate: quote.createdOn, orderNumber: "B-MUSTER-2026",
      paymentWithoutDiscount: true, invoiceDesign: "brand-v1",
    },
  });
  await writeFile("C:\\Users\\albin\\.copilot\\session-state\\da28cf3c-2ff4-4486-915b-1d4adfb0459d\\files\\musterrechnung.pdf", pdf);
});

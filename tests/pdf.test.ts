import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { buildPdf } from "../src/lib/pdf";
import { seller } from "../src/lib/config";
import type { DocumentRow } from "../src/lib/orders";
import { money } from "../src/lib/catalog";
import { priceQuote } from "../src/lib/pricing";
import { fixture } from "./fixtures";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function invoice(): DocumentRow {
  const { order, quote } = fixture();
  return {
    id: "test-document", order_id: "test-order", participant_index: 0, kind: "invoice",
    number: "R-2026-123456", created_at: "2026-11-02T10:00:00Z",
    snapshot: {
      seller: { ...seller(), name: "Musterhandel", street: "Musterweg 1", postcode: "12345", city: "Musterstadt", email: "info@example.invalid", taxId: "DE123456789", bankName: "Musterbank", iban: "DE00 0000 0000 0000 0000 00", bic: "TESTDE00" },
      participant: order.participants[0], product: order.product, line: quote.lines[0],
      issueDate: quote.createdOn, orderNumber: "B-2026-123456",
      paymentWithoutDiscount: true, invoiceDesign: "brand-v1",
    },
  };
}
describe("branded invoice layout", () => {
  it("embeds the logo with complete invoice, delivery, tax and bank details in one page", async () => {
    const document = invoice();
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const image = vi.spyOn(PDFPage.prototype, "drawImage");
    const buffer = await buildPdf(document);
    const text = draw.mock.calls.map(([text]) => text).join("\n");
    const loaded = await PDFDocument.load(buffer);
    expect(loaded.getPageCount()).toBe(1);
    expect(image).toHaveBeenCalledTimes(1);
    for (const value of ["RECHNUNG", document.number, document.snapshot.orderNumber, "Musterhandel", "Musterweg 1", "12345 Musterstadt",
      "Winterdienst 1 GmbH", "Bürostraße 1", "Gesamt netto inkl. Lieferung:", "Umsatzsteuer 19 %:", "Rechnungsbetrag brutto:",
      money(document.snapshot.line.netCents), money(document.snapshot.line.vatCents), money(document.snapshot.line.grossCents),
      "Zahlungsziel: 14 Tage nach tatsächlicher Lieferung.", "Zahlbar ohne Abzug. Kein Skonto.", "IBAN: DE00 0000 0000 0000 0000 00",
      "Verwendungszweck: R-2026-123456", "Steuerangabe des Rechnungsstellers: DE123456789", "Voraussichtliche Lieferung", "Lieferadresse:"]) {
      expect(text).toContain(value);
    }
    expect(text).not.toMatch(/Lieferant|Lieferkosten|Warenwert/);
    expect(loaded.getTitle()).toBe("Rechnung R-2026-123456");
  });
  it("wraps maximum-length fields and paginates without clipping or losing payment information", async () => {
    const document = invoice();
    document.snapshot.participant.company = "Winterdienst und kommunale Einrichtungen ".repeat(4).slice(0, 160);
    document.snapshot.participant.contact = "Łukasz Иванов Ansprechpartner ".repeat(6).slice(0, 160);
    document.snapshot.participant.billingAddress.street = "Industriegebiet am großen Gewerbepark ".repeat(5).slice(0, 160);
    document.snapshot.participant.address.street = document.snapshot.participant.billingAddress.street;
    document.snapshot.participant.billingAddress.city = "Musterstadt ".repeat(14).slice(0, 160);
    document.snapshot.participant.address.city = document.snapshot.participant.billingAddress.city;
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const buffer = await buildPdf(document);
    const pages = (await PDFDocument.load(buffer)).getPageCount();
    expect(pages).toBeGreaterThan(1);
    for (const [value, options] of draw.mock.calls) {
      if (!options?.font || options.x === undefined || options.y === undefined || options.size === undefined) throw new Error("Missing PDF text geometry.");
      expect(options.x).toBeGreaterThanOrEqual(47);
      expect(options.x + options.font.widthOfTextAtSize(value, options.size)).toBeLessThanOrEqual(548);
      expect(options.y).toBeGreaterThanOrEqual(25);
      expect(options.y).toBeLessThanOrEqual(810);
    }
    const text = draw.mock.calls.map(([text]) => text).join("\n");
    expect(text).toContain("Verwendungszweck: R-2026-123456");
    expect(text).toContain("Zahlbar ohne Abzug. Kein Skonto.");
    for (let index = 1; index <= pages; index++) expect(text).toContain(`Seite ${index} / ${pages}`);
  });
  it("keeps a normal mixed-load invoice on one page with both inclusive position amounts", async () => {
    const document = invoice();
    const base = fixture([46]);
    const quote = priceQuote({ ...base.input, items: [{ product: "bigbag", tonnes: 23 }, { product: "bags", tonnes: 23 }] }, { metres: 1500123, states: ["RP"], labels: ["Mainz"] });
    document.snapshot.line = quote.lines[0];
    document.snapshot.items = quote.items;
    document.snapshot.participant = base.order.participants[0];
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const buffer = await buildPdf(document);
    const text = draw.mock.calls.map(([value]) => value).join("\n");
    expect((await PDFDocument.load(buffer)).getPageCount()).toBe(1);
    expect(text).toContain("23 Tonnen Streusalz im BigBag");
    expect(text).toContain("23 Tonnen Streusalz in 25-kg-Säcken");
    expect(text).toContain("920 Säcke");
    for (const item of quote.items!) expect(text).toContain(money(item.netCents));
    expect(text).toContain(money(quote.grossCents));
    expect(text).toContain("Verwendungszweck: R-2026-123456");
  });
  it("leaves stored invoices without a design version on their original renderer", async () => {
    const document = invoice();
    delete document.snapshot.invoiceDesign;
    const image = vi.spyOn(PDFPage.prototype, "drawImage");
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    await buildPdf(document);
    expect(image).not.toHaveBeenCalled();
    expect(text.mock.calls.map(([value]) => value).join("\n")).toContain("STREUSALZ GROSSHANDEL");
  });
  it("rejects inconsistent position amounts and unsupported customer characters explicitly", async () => {
    const document = invoice();
    document.snapshot.items = [{ product: "bigbag", tonnes: 23, netCents: 1 }];
    await expect(buildPdf(document)).rejects.toThrow("Rechnungspositionen");
    delete document.snapshot.items;
    document.snapshot.participant.company = "Unsupported \u{1F9C2}";
    await expect(buildPdf(document)).rejects.toThrow("PDF-Schrift");
  });
});

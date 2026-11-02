import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentRow } from "./orders";
import { PRODUCTS, money, displayDate } from "./catalog";
import { AppError } from "./errors";

let fonts: Promise<Buffer[]> | undefined;
export async function buildPdf(document: DocumentRow) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fonts ??= Promise.all(["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"].map(file => readFile(join(process.cwd(), "assets", "fonts", file))));
  const [regularData, boldData] = await fonts;
  const font = await pdf.embedFont(regularData, { subset: true });
  const bold = await pdf.embedFont(boldData, { subset: true });
  const supportedCharacters = new Set(font.getCharacterSet());
  const { seller, participant, product, line, issueDate, orderNumber, deliveredOn } = document.snapshot;
  let page = pdf.addPage([595.28, 841.89]);
  let y = 785;
  const navy = rgb(.06, .14, .24);
  function write(text: string, size = 11, strong = false, gap = 18) {
    const selected = strong ? bold : font;
    const lines: string[] = [];
    let current = "";
    for (const character of text) {
      if (!supportedCharacters.has(character.codePointAt(0)!)) throw new AppError("Ein Dokument enthält Zeichen, die von der PDF-Schrift nicht unterstützt werden. Bitte die Kundenangaben prüfen oder den Support kontaktieren.", 422);
      if (selected.widthOfTextAtSize(current + character, size) > 485) {
        const space = current.lastIndexOf(" ");
        if (space > 0) { lines.push(current.slice(0, space)); current = current.slice(space + 1) + character; }
        else { lines.push(current); current = character; }
      } else current += character;
    }
    if (current) lines.push(current);
    for (const line of lines) {
      if (y < 105) { page = pdf.addPage([595.28, 841.89]); y = 785; }
      page.drawText(line, { x: 55, y, size, font: selected, color: navy });
      y -= gap;
    }
  }
  pdf.setTitle(`${document.kind === "invoice" ? "Rechnung" : "Lieferschein"} ${document.number}`);
  pdf.setAuthor(seller.name);
  pdf.setCreationDate(new Date(document.created_at));
  pdf.setModificationDate(new Date(document.created_at));
  write("STREUSALZ GROSSHANDEL", 21, true, 30);
  write(`${seller.name} | ${seller.street} | ${seller.postcode} ${seller.city}`, 9, false, 15);
  write(`${seller.email} | ${seller.phone}`, 9);
  y -= 30;
  write(participant.company, 12, true);
  write(participant.contact);
  const address = document.kind === "invoice" ? participant.billingAddress : participant.address;
  write(address.street);
  write(`${address.postcode} ${address.city}`);
  if (participant.vatId && document.kind === "invoice") write(`USt-IdNr. Kunde: ${participant.vatId}`, 9);
  y -= 30;
  write(`${document.kind === "invoice" ? "RECHNUNG" : "LIEFERSCHEIN"} ${document.number}`, 20, true, 31);
  write(`Ausstellungsdatum: ${displayDate(issueDate)} | Bestellung: ${orderNumber}`, 10);
  write(`${document.kind === "delivery" ? "Lieferdatum" : "Voraussichtliche Lieferung (unverbindlich)"}: ${displayDate(deliveredOn || line.deliveryDate)}`, 10);
  y -= 22;
  write(`${line.tonnes} Tonnen ${PRODUCTS[product].name}`, 13, true, 24);
  write(product === "bags" ? `${line.tonnes} Paletten mit je 40 x 25 kg (${line.tonnes * 40} Säcke)` : `${line.tonnes} BigBags mit je 1.000 kg`, 10);
  if (document.kind === "invoice") {
    y -= 20;
    if (line.deliveryIncluded) {
      write("Streusalz inklusive Lieferung");
      write(`Gesamt netto inkl. Lieferung: ${money(line.netCents)}`, 12, true, 25);
    } else {
      write(`Einzelpreis netto: ${money(PRODUCTS[product].priceCents)} / Tonne`);
      write(`Warenwert netto: ${money(line.goodsCents)}`);
      write(`Lieferkosten netto (mengenproportionaler Anteil): ${money(line.freightCents)}`);
      write(`Gesamt netto: ${money(line.netCents)}`, 12, true, 25);
    }
    write(`Umsatzsteuer 19 %: ${money(line.vatCents)}`);
    write(`Rechnungsbetrag brutto: ${money(line.grossCents)}`, 16, true, 30);
    y -= 10;
    write("Zahlungsziel: 14 Tage nach tatsächlicher Lieferung.", 11, true);
    if (document.snapshot.paymentWithoutDiscount) write("Zahlbar ohne Abzug. Kein Skonto.", 11, true);
    write("Das konkrete Fälligkeitsdatum folgt mit der Lieferbestätigung. Bitte nicht vom Rechnungsdatum aus berechnen.", 9, false, 15);
    write(`Verwendungszweck: ${document.number}`, 10);
    write(`Bank: ${seller.bankName} | IBAN: ${seller.iban}${seller.bic ? ` | BIC: ${seller.bic}` : ""}`, 10);
    write(`Steuerangabe des Rechnungsstellers: ${seller.taxId}`, 9);
    y -= 12;
    write(`Lieferadresse: ${participant.address.street}, ${participant.address.postcode} ${participant.address.city}`, 9);
  } else {
    y -= 20;
    write(`Zugehörige Rechnung: ${document.snapshot.invoiceNumber}`, 11);
    write("Die Lieferung wurde vom Auftraggeber als abgeschlossen erfasst.", 10);
    write("Dieses Dokument ist keine unterschriebene Empfangsquittung.", 10);
  }
  const pages = pdf.getPages();
  pages.forEach((page, index) => page.drawText(`${seller.name} | ${document.number} | Seite ${index + 1} / ${pages.length}`, { x: 55, y: 45, size: 8, font, color: navy }));
  return Buffer.from(await pdf.save());
}

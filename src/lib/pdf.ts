import "server-only";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentRow } from "./orders";
import { PRODUCTS, money, displayDate } from "./catalog";
import { AppError } from "./errors";

let fonts: Promise<Buffer[]> | undefined;
let logoData: Promise<Buffer> | undefined;
export async function buildPdf(document: DocumentRow) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fonts ??= Promise.all(["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"].map(file => readFile(join(process.cwd(), "assets", "fonts", file))));
  const [regularData, boldData] = await fonts;
  const font = await pdf.embedFont(regularData, { subset: true });
  const bold = await pdf.embedFont(boldData, { subset: true });
  const supportedCharacters = new Set(font.getCharacterSet());
  const { seller, participant, product, line, issueDate, orderNumber, deliveredOn } = document.snapshot;
  pdf.setTitle(`${document.kind === "invoice" ? "Rechnung" : "Lieferschein"} ${document.number}`);
  pdf.setAuthor(seller.name);
  pdf.setCreationDate(new Date(document.created_at));
  pdf.setModificationDate(new Date(document.created_at));
  if (document.kind === "invoice" && document.snapshot.invoiceDesign === "brand-v1" && line.deliveryIncluded) {
    await drawBrandedInvoice(pdf, font, bold, document);
    return Buffer.from(await pdf.save());
  }
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
  write("STREUSALZ GROSSHANDEL", 21, true, 30);
  write(`${seller.name} | ${seller.street} | ${seller.postcode} ${seller.city}`, 9, false, 15);
  write(seller.email + ("phone" in seller && typeof seller.phone === "string" ? ` | ${seller.phone}` : ""), 9);
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
  for (const item of document.snapshot.items ?? [{ product, tonnes: line.tonnes }]) {
    write(`${item.tonnes} Tonnen ${PRODUCTS[item.product].name}`, 13, true, 24);
    write(item.product === "bags" ? `${item.tonnes} Paletten mit je 40 x 25 kg (${item.tonnes * 40} Säcke)` : `${item.tonnes} BigBags mit je 1.000 kg`, 10);
    if (document.kind === "invoice" && "netCents" in item) write(`Positionspreis netto inkl. Lieferung: ${money(item.netCents)}`, 10);
  }
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

async function drawBrandedInvoice(pdf: PDFDocument, font: PDFFont, bold: PDFFont, document: DocumentRow) {
  const { seller, participant, product, line, issueDate, orderNumber, items } = document.snapshot;
  logoData ??= readFile(join(process.cwd(), "public", "images", "streusalz-logo.png"));
  const logo = await pdf.embedPng(await logoData);
  const navy = rgb(.04, .16, .29), gold = rgb(.83, .62, .22), muted = rgb(.35, .41, .47);
  const border = rgb(.85, .89, .91), pale = rgb(.96, .97, .98), green = rgb(.93, .97, .94);
  const left = 48, right = 547.28, width = right - left;
  const characters = new Set(font.getCharacterSet());
  const positions = items ?? [{ product, tonnes: line.tonnes, netCents: line.netCents }];
  if (positions.reduce((sum, item) => sum + item.netCents, 0) !== line.netCents) {
    throw new AppError("Die Rechnungspositionen stimmen nicht mit dem Gesamtbetrag überein.", 422);
  }
  function wrap(text: string, size: number, maxWidth: number, strong = false) {
    const selected = strong ? bold : font;
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let current = "";
      for (const character of paragraph) {
        if (!characters.has(character.codePointAt(0)!)) throw new AppError("Ein Dokument enthält Zeichen, die von der PDF-Schrift nicht unterstützt werden. Bitte die Kundenangaben prüfen oder den Support kontaktieren.", 422);
        if (selected.widthOfTextAtSize(current + character, size) > maxWidth) {
          const space = current.lastIndexOf(" ");
          if (space > 0) { lines.push(current.slice(0, space)); current = current.slice(space + 1); }
          else { lines.push(current); current = ""; }
        }
        current += character;
      }
      lines.push(current);
    }
    return lines;
  }
  let page = pdf.addPage([595.28, 841.89]);
  let y = 728;
  function header() {
    page.drawRectangle({ x: 0, y: 831.89, width: 595.28, height: 10, color: navy });
    page.drawImage(logo, { x: left, y: 764, width: 86, height: 86 * logo.height / logo.width });
    page.drawText("STREUSALZ GROSSHANDEL", { x: 150, y: 791, size: 15, font: bold, color: navy });
    page.drawText("Große Mengen. Klare Konditionen.", { x: 150, y: 774, size: 9, font, color: muted });
    page.drawLine({ start: { x: left, y: 747 }, end: { x: right, y: 747 }, thickness: 1.5, color: gold });
  }
  header();
  function ensureSpace(height: number) {
    if (y - height >= 88) return;
    page = pdf.addPage([595.28, 841.89]);
    header();
    y = 725;
    page.drawText(`Rechnung ${document.number} · Fortsetzung`, { x: left, y, size: 11, font: bold, color: navy });
    y -= 28;
  }
  function textAt(text: string, x: number, top: number, size = 9, strong = false, maxWidth = width, color = navy) {
    const lines = wrap(text, size, maxWidth, strong);
    for (const value of lines) {
      page.drawText(value, { x, y: top, size, font: strong ? bold : font, color });
      top -= size * 1.5;
    }
    return top;
  }
  function paragraph(text: string, size = 9, strong = false, color = navy) {
    for (const value of wrap(text, size, width, strong)) {
      ensureSpace(size * 1.5);
      page.drawText(value, { x: left, y, size, font: strong ? bold : font, color });
      y -= size * 1.5;
    }
  }
  function amount(value: number, end: number, top: number, size = 10, strong = false) {
    const text = money(value), selected = strong ? bold : font;
    page.drawText(text, { x: end - selected.widthOfTextAtSize(text, size), y: top, size, font: selected, color: navy });
  }
  y = textAt("RECHNUNG", left, y, 25, true);
  y = textAt(`${seller.name} · ${seller.street} · ${seller.postcode} ${seller.city}`, left, y - 3, 8, false, width, muted) - 16;
  const columnsTop = y;
  let addressY = textAt("RECHNUNG AN", left, y, 8, true, 280, muted) - 3;
  for (const [index, value] of [participant.company, participant.contact, participant.billingAddress.street, `${participant.billingAddress.postcode} ${participant.billingAddress.city}`].entries()) {
    addressY = textAt(value, left, addressY, index === 0 ? 11 : 10, index === 0, 280);
  }
  if (participant.vatId) addressY = textAt(`USt-IdNr. Kunde: ${participant.vatId}`, left, addressY - 3, 8, false, 280);
  let metadataY = columnsTop;
  for (const [label, value] of [["Rechnungsnummer", document.number], ["Rechnungsdatum", displayDate(issueDate)], ["Ihre Bestellung", orderNumber]]) {
    metadataY = textAt(label, 365, metadataY, 8, false, right - 365, muted);
    metadataY = textAt(value, 365, metadataY, 10, true, right - 365) - 3;
  }
  y = Math.min(addressY, metadataY) - 10;
  paragraph("Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Lieferung:", 9);
  y -= 9;
  function tableHeader() {
    page.drawRectangle({ x: left, y: y - 19, width, height: 25, color: navy });
    for (const [text, x] of [["Menge", left + 9], ["Artikel / Leistung", 104], ["Netto / t", 365], ["Betrag netto", 467]] as const) {
      page.drawText(text, { x, y: y - 10, size: 8, font: bold, color: rgb(1, 1, 1) });
    }
    y -= 34;
  }
  ensureSpace(100);
  tableHeader();
  for (const [index, item] of positions.entries()) {
    const description = `${item.tonnes} Tonnen ${PRODUCTS[item.product].name}`;
    const detail = item.product === "bags" ? `${item.tonnes} Paletten mit je 40 x 25 kg (${item.tonnes * 40} Säcke)` : `${item.tonnes} BigBags mit je 1.000 kg`;
    const height = wrap(description, 9, 245, true).length * 13.5 + wrap(detail, 8, 245).length * 12 + 21;
    if (y - height < 88) { ensureSpace(height + 34); tableHeader(); }
    if (index % 2 === 0) page.drawRectangle({ x: left, y: y - height + 12, width, height, color: pale });
    textAt(`${item.tonnes} t`, left + 9, y, 9, true, 43);
    const detailY = textAt(description, 104, y, 9, true, 245);
    textAt(detail, 104, detailY - 2, 8, false, 245, muted);
    textAt("Inklusive Lieferung", 104, y - height + 20, 8, false, 245, muted);
    amount(item.netCents / item.tonnes, 434, y, 9);
    amount(item.netCents, right - 9, y, 10, true);
    page.drawLine({ start: { x: left, y: y - height + 12 }, end: { x: right, y: y - height + 12 }, thickness: .5, color: border });
    y -= height;
  }
  y -= 7;
  ensureSpace(104);
  page.drawRectangle({ x: left, y: y - 80, width, height: 97, color: green });
  textAt("Gesamt netto inkl. Lieferung:", left + 14, y - 3, 9);
  amount(line.netCents, right - 14, y - 3, 10);
  textAt("Umsatzsteuer 19 %:", left + 14, y - 24, 9);
  amount(line.vatCents, right - 14, y - 24, 10);
  page.drawLine({ start: { x: left + 14, y: y - 36 }, end: { x: right - 14, y: y - 36 }, thickness: .5, color: border });
  textAt("Rechnungsbetrag brutto:", left + 14, y - 61, 13, true);
  amount(line.grossCents, right - 14, y - 61, 17, true);
  y -= 106;
  const paymentLines = [
    "Zahlungsziel: 14 Tage nach tatsächlicher Lieferung.",
    ...(document.snapshot.paymentWithoutDiscount ? ["Zahlbar ohne Abzug. Kein Skonto."] : []),
    "Das konkrete Fälligkeitsdatum erhalten Sie nach der Lieferung. Bitte nicht vom Rechnungsdatum aus berechnen.",
  ];
  const paymentHeight = 32 + paymentLines.reduce((sum, text) => sum + wrap(text, 9, width).length * 13.5, 0);
  ensureSpace(paymentHeight);
  paragraph("Einfach per Überweisung", 12, true);
  y -= 3;
  for (const text of paymentLines) paragraph(text, 9, text !== paymentLines.at(-1));
  y -= 13;
  const bankLines = [`Kontoinhaber: ${seller.name}`, `Bank: ${seller.bankName}`, `IBAN: ${seller.iban}`, ...(seller.bic ? [`BIC: ${seller.bic}`] : []), `Verwendungszweck: ${document.number}`];
  const bankHeight = bankLines.reduce((sum, text) => sum + wrap(text, 9, width - 28, text.startsWith("IBAN:")).length * 13.5, 0) + 22;
  const deliveryLines = [
    `Voraussichtliche Lieferung (unverbindlich): ${displayDate(line.deliveryDate)}`,
    `Lieferadresse: ${participant.company}, ${participant.address.street}, ${participant.address.postcode} ${participant.address.city}`,
  ];
  const closingHeight = deliveryLines.reduce((sum, text) => sum + wrap(text, 8, width).length * 12, 0) + 15;
  ensureSpace(bankHeight + 5 + closingHeight);
  page.drawRectangle({ x: left, y: y - bankHeight + 12, width, height: bankHeight, color: pale });
  let bankY = y;
  for (const text of bankLines) bankY = textAt(text, left + 14, bankY, 9, text.startsWith("IBAN:"), width - 28);
  y -= bankHeight + 5;
  for (const text of deliveryLines) paragraph(text, 8, false, muted);
  paragraph("Vielen Dank für Ihr Vertrauen.", 10, true);
  const pages = pdf.getPages();
  for (const [index, current] of pages.entries()) {
    current.drawLine({ start: { x: left, y: 66 }, end: { x: right, y: 66 }, thickness: 1, color: gold });
    const footer = wrap(`${seller.email} · Steuerangabe des Rechnungsstellers: ${seller.taxId}`, 7, width - 100);
    let footerY = 51;
    for (const value of footer) {
      current.drawText(value, { x: left, y: footerY, size: 7, font, color: muted });
      footerY -= 10;
    }
    current.drawText(`Seite ${index + 1} / ${pages.length}`, { x: right - 65, y: 51, size: 8, font, color: muted });
  }
}

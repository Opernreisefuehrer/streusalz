import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import type { Database } from "./db";
import type { Participant, OrderInput } from "./validation";
import type { Quote } from "./pricing";
import { productContents, displayDate, money } from "./catalog";
import { berlinDate, dueDate } from "./delivery-date";
import { seller, siteUrl } from "./config";
import { AppError } from "./errors";
import { buildPdf } from "./pdf";
import { legalTexts } from "./legal";

export type OrderStatus = "ordered" | "supplier_confirmed" | "invoiced" | "delivered";
export const STATUS_LABELS: Record<OrderStatus, string> = {
  ordered: "Bestellung eingegangen", supplier_confirmed: "Lieferant bestätigt", invoiced: "Rechnung freigegeben", delivered: "Geliefert",
};
export interface OrderSnapshot {
  product: OrderInput["product"];
  items?: OrderInput["items"];
  participants: Participant[];
  quote: Quote;
  termsText: string;
  privacyText: string;
  legalVersion: string;
  paymentWithoutDiscount?: boolean;
}
export interface OrderRow {
  id: string;
  number: string;
  request_id: string;
  created_at: Date | string;
  status: OrderStatus;
  snapshot: OrderSnapshot;
  supplier_reference: string | null;
  delivered_dates: string[] | null;
}
export interface DocumentSnapshot {
  seller: ReturnType<typeof seller>;
  participant: Participant;
  product: OrderInput["product"];
  items?: Quote["items"];
  line: Quote["lines"][number];
  orderNumber: string;
  issueDate: string;
  deliveredOn?: string;
  invoiceNumber?: string;
  paymentWithoutDiscount?: boolean;
}
export interface DocumentRow {
  id: string;
  order_id: string;
  participant_index: number;
  kind: "invoice" | "delivery";
  number: string;
  created_at: Date | string;
  snapshot: DocumentSnapshot;
}
export interface MailRow {
  id: string;
  order_id: string;
  document_id: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  sent_at: Date | string | null;
}
export async function getOrder(db: Database, id: string, lock = false) {
  const [order] = await db.query<OrderRow>(`SELECT * FROM orders WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  if (!order) throw new AppError("Bestellung nicht gefunden.", 404);
  return order;
}
async function audit(db: Database, id: string, action: string, actor: string) {
  await db.query("INSERT INTO audit_log(order_id,action,actor) VALUES($1,$2,$3)", [id, action, actor]);
}
async function enqueue(db: Database, orderId: string, recipient: string, subject: string, body: string, documentId: string | null = null) {
  await db.query("INSERT INTO outbox(id,order_id,document_id,recipient,subject,body) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), orderId, documentId, recipient, subject, body]);
}
export async function createOrder(db: Database, input: OrderInput, quote: Quote) {
  const copyEmail = process.env.ORDER_NOTIFICATION_EMAIL?.trim();
  if (copyEmail && !z.email().safeParse(copyEmail).success) throw new AppError("Die E-Mail-Adresse für Bestellkopien ist ungültig konfiguriert.", 503);
  return db.transaction(async tx => {
    // Serializes the same request ID even when a retry arrives before the first transaction commits.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.requestId]);
    const [existing] = await tx.query<OrderRow>("SELECT * FROM orders WHERE request_id=$1", [input.requestId]);
    if (existing) {
      if (!isDeepStrictEqual(existing.snapshot.participants, input.participants)
        || !isDeepStrictEqual(existing.snapshot.items, input.items)
        || existing.snapshot.product !== input.product) throw new AppError("Diese Bestellanfrage wurde bereits mit anderen Daten verarbeitet.", 409);
      return existing;
    }
    const conditions = legalTexts();
    if (input.legalVersion !== conditions.version) throw new AppError("Die Vertrags- oder Datenschutzhinweise wurden geändert. Bitte laden Sie das Bestellformular neu und prüfen Sie die aktuelle Fassung.", 409);
    const [{ seq }] = await tx.query<{ seq: string }>("SELECT nextval('order_numbers')::text AS seq");
    const id = randomUUID();
    const number = `B-${quote.createdOn.slice(0, 4)}-${seq.padStart(6, "0")}`;
    const snapshot: OrderSnapshot = { product: input.product, ...(input.items ? { items: input.items } : {}), participants: input.participants, quote, termsText: conditions.terms, privacyText: conditions.privacy, legalVersion: conditions.version, paymentWithoutDiscount: true };
    for (const [index, participant] of input.participants.entries()) {
      await buildPdf({
        id, order_id: id, participant_index: index, kind: "invoice", number, created_at: new Date(),
        snapshot: { seller: seller(), participant, product: input.product, items: quote.items, line: quote.lines[index], orderNumber: number, issueDate: quote.createdOn, paymentWithoutDiscount: snapshot.paymentWithoutDiscount },
      });
    }
    const [order] = await tx.query<OrderRow>(
      "INSERT INTO orders(id,number,request_id,status,snapshot) VALUES($1,$2,$3,'ordered',$4::jsonb) RETURNING *",
      [id, number, input.requestId, JSON.stringify(snapshot)],
    );
    for (const [index, participant] of input.participants.entries()) {
      const line = quote.lines[index];
      const body = `Guten Tag ${participant.contact},\n\nvielen Dank für Ihre Bestellung bei Streusalz Großhandel.\nIhre Bestellung ${number} ist eingegangen. Dies ist eine Eingangsbestätigung, noch keine Lieferzusage oder Rechnung.\n\nIhre Bestellung:\n${productContents(input.product, line.tonnes, quote.items)}\nInklusive Lieferung\nGesamt netto inkl. Lieferung: ${money(line.netCents)}\n19 % MwSt.: ${money(line.vatCents)}\nGesamt brutto inkl. Lieferung: ${money(line.grossCents)}\n\nLieferadresse: ${participant.company}, ${participant.address.street}, ${participant.address.postcode} ${participant.address.city}\nVoraussichtlicher Liefertermin: ${displayDate(line.deliveryDate)} (unverbindlich)\n\nWir stimmen Ihre Bestellung mit unserem Lieferanten ab. Nach dessen Bestätigung erhalten Sie die manuell freigegebene Rechnung. Zahlungsziel: 14 Tage nach tatsächlicher Lieferung. Zahlbar ohne Abzug. Kein Skonto.\n${input.participants.length > 1 ? "\nBei Gemeinschaftsbestellungen erhält jeder teilnehmende Auftraggeber eine eigene Rechnung über seinen Gesamtpreis inklusive Lieferung.\n" : ""}\nFreundliche Grüße\nStreusalz Großhandel\n${seller().name}\n${seller().email}`;
      await enqueue(tx, id, participant.email, `Vielen Dank für Ihre Bestellung ${number}`, `${body}\n\nDies ist noch keine Auftragsannahme. Hier erhalten Sie die bei Ihrer Bestellabgabe geltenden AGB:\n\n${snapshot.termsText}\n\nDatenschutzhinweise zur Verarbeitung Ihrer Angaben, auch bei Eintragung durch einen Gemeinschaftsbesteller:\n${siteUrl()}/datenschutz`);
    }
    const notificationRecipients = new Set([process.env.ADMIN_EMAIL || seller().email, ...(copyEmail ? [copyEmail] : [])].map(email => email.toLowerCase()));
    for (const recipient of notificationRecipients) await enqueue(tx, id, recipient, `Neue Bestellung ${number} · ${quote.totalTonnes} Tonnen`,
      `Neue Bestellung ${number}\n\n${productContents(input.product, quote.totalTonnes, quote.items)}\nGesamtmenge: ${quote.totalTonnes} Tonnen (${quote.trucks} Lkw)\nGesamt brutto: ${money(quote.grossCents)}\n\n${input.participants.map((participant, index) => `${participant.company}: ${participant.tonnes} t\n${participant.address.street}, ${participant.address.postcode} ${participant.address.city}\nKontakt: ${participant.contact}, ${participant.email}, ${participant.phone}\nTeilbetrag brutto: ${money(quote.lines[index].grossCents)}`).join("\n\n")}\n\nBitte manuell beim Lieferanten bestellen, dessen Bestätigung erfassen und erst danach die Rechnungen freigeben.\nGeschützte Verwaltung: ${siteUrl()}/admin/bestellungen/${id}`);
    await audit(tx, id, "Bestellung erfasst; Kundenbestätigungen und Adminbenachrichtigung in Versandwarteschlange", "customer");
    return order;
  });
}
export async function confirmSupplier(db: Database, id: string, reference: string, actor: string) {
  await db.transaction(async tx => {
    const order = await getOrder(tx, id, true);
    if (order.status !== "ordered") throw new AppError("Die Lieferantenbestätigung wurde bereits erfasst oder der Auftrag ist weiter fortgeschritten.", 409);
    await tx.query("UPDATE orders SET status='supplier_confirmed',supplier_reference=$2 WHERE id=$1", [id, reference]);
    await audit(tx, id, `Lieferantenbestätigung erfasst: ${reference}`, actor);
  });
}
async function insertDocument(tx: Database, order: OrderRow, index: number, kind: DocumentRow["kind"], deliveredOn?: string) {
  const sequence = kind === "invoice" ? "invoice_numbers" : "delivery_numbers";
  const [{ seq }] = await tx.query<{ seq: string }>(`SELECT nextval('${sequence}')::text AS seq`);
  const issueDate = berlinDate();
  const number = `${kind === "invoice" ? "R" : "L"}-${issueDate.slice(0, 4)}-${seq.padStart(6, "0")}`;
  const snapshot: DocumentSnapshot = {
    seller: seller(), participant: order.snapshot.participants[index], product: order.snapshot.product, items: order.snapshot.quote.items,
    line: order.snapshot.quote.lines[index], orderNumber: order.number, issueDate, paymentWithoutDiscount: order.snapshot.paymentWithoutDiscount,
    ...(deliveredOn ? { deliveredOn } : {}),
  };
  if (kind === "delivery") {
    const [invoice] = await tx.query<DocumentRow>("SELECT * FROM documents WHERE order_id=$1 AND participant_index=$2 AND kind='invoice'", [order.id, index]);
    if (!invoice) throw new AppError("Für diese Lieferung fehlt die freigegebene Rechnung.", 409);
    snapshot.invoiceNumber = invoice.number;
    snapshot.seller = invoice.snapshot.seller;
    snapshot.paymentWithoutDiscount = invoice.snapshot.paymentWithoutDiscount;
  }
  const document: DocumentRow = { id: randomUUID(), order_id: order.id, participant_index: index, kind, number, created_at: new Date(), snapshot };
  await buildPdf(document);
  await tx.query("INSERT INTO documents(id,order_id,participant_index,kind,number,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [document.id, order.id, index, kind, number, JSON.stringify(snapshot)]);
  const participant = snapshot.participant;
  const body = kind === "invoice"
    ? `Guten Tag ${participant.contact},\n\nunser Lieferant hat Ihre Bestellung ${order.number} bestätigt. Hiermit nehmen wir Ihr Angebot für ${productContents(snapshot.product, snapshot.line.tonnes, snapshot.items).replaceAll("\n", " und ")} zu den bei Bestellung bestätigten Bedingungen ausdrücklich an.\n\nAnbei erhalten Sie Ihre Rechnung ${number} über ${money(snapshot.line.grossCents)} ${snapshot.line.deliveryIncluded ? "inklusive Lieferung und MwSt." : "inklusive MwSt."}${order.snapshot.participants.length > 1 ? " Sie schulden nur Ihren eigenen Rechnungsbetrag, nicht die Rechnungsbeträge anderer Teilnehmer." : ""}\n\nVoraussichtlicher Liefertermin: ${displayDate(snapshot.line.deliveryDate)} (unverbindlich).\nZahlungsziel: 14 Tage nach der tatsächlichen Lieferung, nicht 14 Tage nach Rechnungsdatum.${snapshot.paymentWithoutDiscount ? " Zahlbar ohne Abzug. Kein Skonto." : ""} Das konkrete Fälligkeitsdatum teilen wir Ihnen nach der Lieferung mit.\n\nBitte geben Sie bei der Überweisung Ihre Rechnungsnummer ${number} an.\n\nFreundliche Grüße\nStreusalz Großhandel\n${snapshot.seller.name}\n${snapshot.seller.email}\n\nBei Bestellung vereinbarte AGB:\n\n${order.snapshot.termsText}`
    : `Guten Tag ${participant.contact},\n\nIhre Lieferung zur Bestellung ${order.number} wurde am ${displayDate(deliveredOn!)} als geliefert erfasst. Anbei erhalten Sie den Lieferschein ${number}.\n\nIhre Rechnung ${snapshot.invoiceNumber} ist am ${displayDate(dueDate(deliveredOn!))} fällig (14 Tage nach Lieferung).${snapshot.paymentWithoutDiscount ? " Zahlbar ohne Abzug. Kein Skonto." : ""} Sollten Sie bereits bezahlt haben, ist keine weitere Zahlung erforderlich.\n\nBei Rückfragen zur Lieferung kontaktieren Sie uns bitte.\n\nFreundliche Grüße\nStreusalz Großhandel\n${snapshot.seller.name}\n${snapshot.seller.email}`;
  await enqueue(tx, order.id, participant.email, `${kind === "invoice" ? "Auftragsannahme und Rechnung" : "Lieferschein"} ${number} · ${order.number}`, body, document.id);
  return document;
}
export async function releaseInvoices(db: Database, id: string, actor: string) {
  await db.transaction(async tx => {
    const order = await getOrder(tx, id, true);
    if (order.status !== "supplier_confirmed") throw new AppError("Rechnungen können nur nach erfasster Lieferantenbestätigung freigegeben werden.", 409);
    const company = seller();
    if (!company.taxId || !company.iban) throw new AppError("Steuerangabe und Bankverbindung müssen vor der Rechnungsfreigabe konfiguriert sein.", 503);
    for (let index = 0; index < order.snapshot.participants.length; index++) await insertDocument(tx, order, index, "invoice");
    await tx.query("UPDATE orders SET status='invoiced' WHERE id=$1", [id]);
    await audit(tx, id, "Teilrechnungen manuell freigegeben; PDF-Mails in Versandwarteschlange", actor);
  });
}
export async function markDelivered(db: Database, id: string, dates: string[], actor: string) {
  await db.transaction(async tx => {
    const order = await getOrder(tx, id, true);
    if (order.status !== "invoiced") throw new AppError("Eine Lieferung kann erst nach Rechnungsfreigabe abgeschlossen werden.", 409);
    if (dates.length !== order.snapshot.participants.length || dates.some(date =>
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))
      || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
      || date > berlinDate() || date < order.snapshot.quote.createdOn)) {
      throw new AppError("Bitte für jede Adresse ein gültiges tatsächliches Lieferdatum zwischen Bestelltag und heute angeben.");
    }
    for (const [index, date] of dates.entries()) await insertDocument(tx, order, index, "delivery", date);
    await tx.query("UPDATE orders SET status='delivered',delivered_dates=$2::jsonb WHERE id=$1", [id, JSON.stringify(dates)]);
    await audit(tx, id, `Lieferung erfasst; Lieferscheine freigegeben: ${dates.join(", ")}`, actor);
  });
}

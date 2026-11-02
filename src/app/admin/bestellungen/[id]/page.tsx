import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminPage } from "@/lib/admin-page";
import { database } from "@/lib/db";
import { getOrder, STATUS_LABELS, type DocumentRow, type MailRow } from "@/lib/orders";
import { productContents, money, displayDate } from "@/lib/catalog";
import { berlinDate, dueDate } from "@/lib/delivery-date";
import { OrderActions, RetryMail } from "@/components/admin-controls";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await adminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await database();
  const order = await getOrder(db, id);
  const [documents, mails, audit] = await Promise.all([
    db.query<DocumentRow>("SELECT * FROM documents WHERE order_id=$1 ORDER BY created_at,participant_index", [id]),
    db.query<MailRow>("SELECT * FROM outbox WHERE order_id=$1 ORDER BY position", [id]),
    db.query<{ created_at: Date | string; action: string; actor: string }>("SELECT created_at,action,actor FROM audit_log WHERE order_id=$1 ORDER BY created_at", [id]),
  ]);
  const pending = mails.some(mail => mail.status === "failed" || mail.status === "pending" || mail.status === "sending");
  return <div className="container admin-shell"><div className="breadcrumbs"><Link href="/admin">Bestellverwaltung</Link> / {order.number}</div><div className="admin-top"><div><h1>{order.number}</h1><p style={{ whiteSpace: "pre-line" }}>{productContents(order.snapshot.product, order.snapshot.quote.totalTonnes, order.snapshot.items)}</p></div><span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span></div>
    {pending && <div className="message message-info">Mindestens eine E-Mail ist noch nicht erfolgreich zum Versand übergeben worden. Der Auftragsstatus und der E-Mail-Versandstatus sind getrennt; bitte unten prüfen.</div>}
    <div className="admin-detail-grid"><div><section className="panel"><p className="eyebrow">UNTERNEHMEN & TEILBETRÄGE</p><h2>Lieferungen und Rechnungen</h2>{order.snapshot.participants.map((participant, index) => {
      const line = order.snapshot.quote.lines[index];
      const deliveredOn = order.delivered_dates?.[index];
      return <div className="quote-line" key={index}><h3>{String.fromCharCode(65 + index)} · {participant.company} · {participant.tonnes} t</h3><p>{participant.contact} · <a href={`mailto:${participant.email}`}>{participant.email}</a> · {participant.phone}</p><p>Lieferung: {participant.address.street}, {participant.address.postcode} {participant.address.city}</p><p>Rechnung: {participant.billingAddress.street}, {participant.billingAddress.postcode} {participant.billingAddress.city}</p>{participant.vatId && <p>USt-IdNr.: {participant.vatId}</p>}<div className="summary-row"><span>Warenwert netto</span><b>{money(line.goodsCents)}</b></div><div className="summary-row"><span>Frachtanteil netto</span><b>{money(line.freightCents)}</b></div><div className="summary-row"><span>19 % MwSt.</span><b>{money(line.vatCents)}</b></div><div className="summary-row"><span>Teilrechnung brutto</span><b>{money(line.grossCents)}</b></div><p>Voraussichtliche Lieferung: {displayDate(line.deliveryDate)}</p>{deliveredOn && <p><b>Geliefert: {displayDate(deliveredOn)} · Zahlung fällig: {displayDate(dueDate(deliveredOn))}</b></p>}</div>;
    })}<div className="summary-row summary-total"><span>Auftrag gesamt brutto</span><b>{money(order.snapshot.quote.grossCents)}</b></div></section>
      <section className="panel"><h2>Dokumente</h2>{documents.length ? documents.map(document => <div key={document.id} className="document-item"><a href={`/api/admin/documents/${document.id}`}>{document.kind === "invoice" ? "Rechnung" : "Lieferschein"} {document.number} ↓ PDF</a><p>{document.snapshot.participant.company} · Ausgestellt {displayDate(document.snapshot.issueDate)}</p></div>) : <p>Noch keine Dokumente ausgestellt. Rechnungen entstehen erst nach Ihrer Freigabe.</p>}</section>
      <section className="panel"><h2>E-Mail-Versand</h2>{mails.map(mail => <div className="mail-item" key={mail.id}><b>{mail.subject}</b><p>{mail.recipient} · {mail.status === "sent" ? "Zum Versand übergeben" : mail.status === "failed" ? "Versand fehlgeschlagen" : mail.status === "sending" ? "Wird versendet" : "Wartet auf Versand"} · {mail.attempts} Versuch(e)</p>{mail.last_error && <p className="message message-error">{mail.last_error}</p>}{(mail.status === "failed" || mail.status === "pending") && <RetryMail id={mail.id} />}</div>)}</section>
    </div><div><OrderActions id={id} status={order.status} participants={order.snapshot.participants.map(participant => participant.company)} today={berlinDate()} createdOn={order.snapshot.quote.createdOn} /><section className="panel"><h2>Lieferantenbestätigung</h2><p>{order.supplier_reference || "Noch nicht erfasst. Bitte zuerst extern beim Lieferanten bestellen."}</p></section><section className="panel"><h2>Auftragsprotokoll</h2>{audit.map((entry, index) => <div className="mail-item" key={index}><b>{entry.action}</b><p>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(entry.created_at))} · {entry.actor}</p></div>)}</section></div></div>
  </div>;
}

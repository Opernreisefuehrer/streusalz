import Link from "next/link";
import { adminPage } from "@/lib/admin-page";
import { database } from "@/lib/db";
import { STATUS_LABELS, type OrderRow, type OrderStatus } from "@/lib/orders";
import { money, productLabel } from "@/lib/catalog";
import { Logout } from "@/components/admin-controls";

export default async function Admin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await adminPage();
  const params = await searchParams;
  const status = Object.hasOwn(STATUS_LABELS, params.status || "") ? params.status as OrderStatus : "";
  const q = (params.q || "").slice(0, 100);
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || "1", 10) || 1));
  const db = await database();
  const [orders, counts, failures, totals] = await Promise.all([
    db.query<OrderRow>("SELECT * FROM orders WHERE ($1='' OR status=$1) AND ($2='' OR number ILIKE $3 OR (snapshot->'participants')::text ILIKE $3) ORDER BY created_at DESC LIMIT 25 OFFSET $4", [status, q, `%${q}%`, (page - 1) * 25]),
    db.query<{ status: OrderStatus; count: number }>("SELECT status,count(*)::int AS count FROM orders GROUP BY status"),
    db.query<{ count: number }>("SELECT count(*)::int AS count FROM outbox WHERE status='failed'"),
    db.query<{ count: number }>("SELECT count(*)::int AS count FROM orders WHERE ($1='' OR status=$1) AND ($2='' OR number ILIKE $3 OR (snapshot->'participants')::text ILIKE $3)", [status, q, `%${q}%`]),
  ]);
  const pageLink = (next: number) => `/admin?${new URLSearchParams({ status, q, page: String(next) })}`;
  return <div className="container admin-shell"><div className="admin-top"><div><p className="eyebrow">STREUSALZ GROSSHANDEL · ADMIN</p><h1>Ihre Bestellungen.</h1></div><Logout /></div>
    <div className="admin-metrics">{(Object.keys(STATUS_LABELS) as OrderStatus[]).map(key => <Link className="metric" href={`/admin?status=${key}`} key={key}><b>{counts.find(count => count.status === key)?.count || 0}</b><span>{STATUS_LABELS[key]}</span></Link>)}</div>
    {failures[0].count > 0 && <div className="message message-error" role="alert">{failures[0].count} E-Mail(s) warten nach einem Versandfehler auf erneuten Versand. Prüfen Sie den Versandstatus in der jeweiligen Bestellung.</div>}
    <form className="admin-filter" action="/admin"><label className="field">Auftragsstatus<select name="status" defaultValue={status}><option value="">Alle Aufträge</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field">Suche<input name="q" defaultValue={q} placeholder="Bestellnummer oder Firma" maxLength={100} /></label><button className="button button-small" type="submit">Filtern</button></form>
    {orders.length ? <div className="order-list">{orders.map(order => <Link href={`/admin/bestellungen/${order.id}`} className="order-card" key={order.id}><div><h2>{order.number} · {order.snapshot.participants.map(participant => participant.company).join(" / ")}</h2><p>{productLabel(order.snapshot.product, order.snapshot.items)} · {order.snapshot.quote.totalTonnes} t · {order.snapshot.participants.length} Lieferadresse(n) · {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(order.created_at))}</p></div><div><span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span><p style={{ marginTop: 7, textAlign: "right" }}>{money(order.snapshot.quote.grossCents)} brutto ↗</p></div></Link>)}</div> : <div className="empty-state"><h2>Noch keine passenden Bestellungen.</h2><p>Neue Aufträge erscheinen hier nach dem Bestellabschluss.</p></div>}
    <div className="button-row">{page > 1 && <Link className="button button-secondary" href={pageLink(page - 1)}>← Zurück</Link>}{page * 25 < totals[0].count && <Link className="button button-secondary" href={pageLink(page + 1)}>Weitere Bestellungen →</Link>}</div>
  </div>;
}

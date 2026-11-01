"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/orders";

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Die Aktion konnte nicht ausgeführt werden.");
  return data;
}
export function AdminLogin() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await post("/api/admin/login", { email: form.get("email"), password: form.get("password") }); router.push("/admin"); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Anmeldung nicht möglich."); }
    finally { setBusy(false); }
  }
  return <form className="panel admin-login" onSubmit={submit}><p className="eyebrow">GESCHÜTZTE BESTELLVERWALTUNG</p><h1>Willkommen zurück.</h1><p>Melden Sie sich an, um Bestellungen und Dokumente zu verwalten.</p><label className="field">E-Mail-Adresse<input type="email" name="email" autoComplete="username" required /></label><label className="field">Passwort<input type="password" name="password" autoComplete="current-password" required /></label>{error && <div role="alert" className="message message-error">{error}</div>}<button className="button full-width" disabled={busy}>{busy ? "Anmelden …" : "Sicher anmelden ↗"}</button></form>;
}
export function Logout() {
  const [error, setError] = useState("");
  const router = useRouter();
  return <div><button className="button button-secondary button-small" onClick={async () => {
    try { await post("/api/admin/logout", {}); router.push("/admin/login"); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Abmeldung fehlgeschlagen."); }
  }}>Abmelden</button>{error && <p role="alert">{error}</p>}</div>;
}
export function OrderActions({ id, status, participants, today, createdOn }: { id: string; status: OrderStatus; participants: string[]; today: string; createdOn: string }) {
  const [reference, setReference] = useState("");
  const [dates, setDates] = useState(participants.map(() => today));
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function action(body: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await post(`/api/admin/orders/${id}`, body);
      setMessage(result.mailFailed ? "Aktion gespeichert. Mindestens eine E-Mail konnte nicht versandt werden. Bitte den Versandstatus prüfen und erneut senden." : "Aktion gespeichert und vorhandene E-Mails zum Versand übergeben.");
      setConfirmation(false); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Aktion fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  return <section className="panel"><p className="eyebrow">MANUELLE FREIGABE</p><h2>Nächster Schritt</h2>
    {status === "ordered" && <><p>Bestellen Sie beim Lieferanten. Sobald dessen Bestätigung vorliegt, erfassen Sie hier die Referenz. Es wird dadurch noch keine Rechnung versendet.</p><label className="field">Referenz der Lieferantenbestätigung<input maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label><div className="button-row"><button disabled={busy || !reference.trim()} className="button" onClick={() => action({ action: "confirm", reference })}>Lieferantenbestätigung erfassen</button></div></>}
    {status === "supplier_confirmed" && <><p>Die Lieferantenbestätigung liegt vor. Die Freigabe erstellt für jedes Unternehmen eine nummerierte PDF-Rechnung mit seinem mengenproportionalen Frachtanteil und startet den E-Mail-Versand. Ausgestellte Dokumente werden nicht nachträglich verändert.</p><div className="message message-info">Bitte aktuelle Produktspezifikation, Entladung, Lkw-Zufahrt und mögliche lokale Sonderfeiertage prüfen. Der automatische Termin verwendet den Bundesland-Kalender.</div><label className="checkbox"><input type="checkbox" checked={confirmation} onChange={event => setConfirmation(event.target.checked)} />Ich habe Kundenangaben, Preise, Lieferbedingungen, lokale Sonderfeiertage und Lieferantenbestätigung geprüft und gebe die Rechnungen zum Versand frei.</label><button className="button full-width" disabled={busy || !confirmation} onClick={() => action({ action: "invoice" })}>Rechnungen freigeben & senden</button></>}
    {status === "invoiced" && <><p>Erfassen Sie nach erfolgter Lieferung das tatsächliche Lieferdatum je Unternehmen. Ein Klick erstellt und versendet alle Lieferscheine und teilt das jeweilige Zahlungsziel (Lieferdatum + 14 Tage) mit.</p>{participants.map((company, index) => <label className="field" key={index} style={{ marginBottom: 15 }}>{company}: tatsächliches Lieferdatum<input type="date" value={dates[index]} min={createdOn} max={today} onChange={event => setDates(current => current.map((date, i) => i === index ? event.target.value : date))} /></label>)}<label className="checkbox"><input type="checkbox" checked={confirmation} onChange={event => setConfirmation(event.target.checked)} />Alle angegebenen Teilmengen wurden tatsächlich geliefert.</label><button className="button full-width" disabled={busy || !confirmation || dates.some(date => !date)} onClick={() => action({ action: "deliver", dates })}>Geliefert markieren & Lieferscheine senden</button></>}
    {status === "delivered" && <div className="message message-success">Der Auftrag wurde als vollständig geliefert erfasst. Dokumente und Versandstatus finden Sie unten.</div>}
    {busy && <p role="status" className="loading-label">Dokumente werden verarbeitet …</p>}
    {error && <div className="message message-error" role="alert">{error}</div>}
    {message && <div className="message message-info" role="status">{message}</div>}
  </section>;
}
export function RetryMail({ id }: { id: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  return <><button className="button button-small button-secondary" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const result = await post("/api/admin/mail", { id });
      if (result.failed) setError("Versand erneut fehlgeschlagen. Bitte SMTP und Serverprotokoll prüfen.");
      else if (result.targetStatus !== "sent") setError("Die E-Mail wartet noch auf den Versand. Bitte vorherige ausstehende Nachrichten dieses Unternehmens prüfen.");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Versand fehlgeschlagen."); }
    finally { setBusy(false); }
  }}>{busy ? "Versenden …" : "Versand erneut anstoßen"}</button>{error && <p role="alert">{error}</p>}</>;
}

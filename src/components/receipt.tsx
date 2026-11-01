"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";

const subscribe = () => () => {};
export function Receipt() {
  const value = useSyncExternalStore(subscribe, () => sessionStorage.getItem("streusalz-receipt"), () => null);
  let receipt: { number: string; mailPending: boolean } | null = null;
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed.number === "string" && /^B-\d{4}-\d+$/.test(parsed.number)) receipt = parsed;
    } catch { /* An invalid local receipt does not authorize access to order data. */ }
  }
  return <section className="container legal-content">{receipt ? <><p className="eyebrow">BESTELLUNG EINGEGANGEN</p><h1>Danke für Ihr Vertrauen.</h1><p>Ihre Bestellnummer: <strong>{receipt.number}</strong></p><div className={`message ${receipt.mailPending ? "message-info" : "message-success"}`}>{receipt.mailPending ? "Ihre Bestellung ist gespeichert. Die E-Mail-Bestätigung wartet noch auf den Versand; Sie müssen nicht erneut bestellen." : "Die Bestellbestätigung wurde zum Versand übergeben. Bitte prüfen Sie auch Ihren Spam-Ordner."}</div><h2>So geht es weiter</h2><ol><li>Wir stimmen den Auftrag mit dem Lieferanten ab.</li><li>Nach seiner Bestätigung geben wir die Rechnung manuell frei.</li><li>Nach der Lieferung erhalten Sie Ihren Lieferschein per E-Mail.</li><li>Ihre Zahlung ist 14 Tage nach tatsächlicher Lieferung fällig.</li></ol><p>Bei Gemeinschaftsbestellungen erhält jedes Unternehmen die Dokumente für seinen Anteil.</p></> : <><h1>Bestellbestätigung</h1><p>Auf diesem Gerät liegt keine Bestellbestätigung vor. Bitte prüfen Sie Ihr E-Mail-Postfach oder kontaktieren Sie uns, wenn Sie eine Bestellung aufgegeben haben.</p></>}<Link className="button" href="/">Zurück zur Startseite ↗</Link></section>;
}

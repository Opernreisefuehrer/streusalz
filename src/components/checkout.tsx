"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCTS, money, displayDate, type Product } from "@/lib/catalog";
import { quoteInputSchema, type Participant } from "@/lib/validation";
import type { FreightEstimate, Quote } from "@/lib/pricing";

const emptyAddress = () => ({ street: "", postcode: "", city: "" });
const emptyParticipant = (tonnes: number): Participant => ({ company: "", contact: "", email: "", phone: "", vatId: "", tonnes, address: emptyAddress(), billingAddress: emptyAddress() });
export function Checkout({ initialProduct, community, enabled, legalVersion }: { initialProduct: Product; community: boolean; enabled: boolean; legalVersion: string }) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [participants, setParticipants] = useState<Participant[]>(community ? [emptyParticipant(10), emptyParticipant(8), emptyParticipant(5)] : [emptyParticipant(23)]);
  const [separateBilling, setSeparateBilling] = useState<boolean[]>(community ? [false, false, false] : [false]);
  const [quote, setQuote] = useState<{ quote: Quote; token: string } | null>(null);
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  const total = participants.reduce((sum, participant) => sum + participant.tonnes, 0);
  const isCommunity = participants.length > 1;
  const validTotal = Number.isSafeInteger(total) && total >= 23 && total % 23 === 0;
  function update(index: number, changes: Partial<Participant>, recalculate = false) {
    setParticipants(current => current.map((participant, i) => i === index ? { ...participant, ...changes } : participant));
    if (recalculate) { setQuote(null); setEstimate(null); setEstimateError(""); }
    requestId.current = null;
  }
  function addParticipant() {
    if (participants.length >= 3) return;
    setParticipants(current => [...current.map((participant, i) => i === 0 && participant.tonnes > 1 ? { ...participant, tonnes: participant.tonnes - 1 } : participant), emptyParticipant(1)]);
    setSeparateBilling(current => [...current, false]);
    setQuote(null); setEstimate(null); setEstimateError(""); requestId.current = null;
  }
  function removeParticipant(index: number) {
    setParticipants(current => current.filter((_, i) => i !== index).map((participant, i) => i === 0 ? { ...participant, tonnes: participant.tonnes + current[index].tonnes } : participant));
    setSeparateBilling(current => current.filter((_, i) => i !== index));
    setQuote(null); setEstimate(null); setEstimateError(""); requestId.current = null;
  }
  async function estimateFreight() {
    setEstimateError(""); setEstimate(null); setBusy(true);
    try {
      const response = await fetch("/api/freight-estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, postcode: participants[0].address.postcode, tonnes: total }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Lieferkosten konnten nicht geschätzt werden.");
      setEstimate(data);
    } catch (error) { setEstimateError(error instanceof Error ? error.message : "Der Lieferkostenservice ist nicht erreichbar."); }
    finally { setBusy(false); }
  }
  async function calculate() {
    setError(""); setQuote(null);
    const input = quoteInputSchema.safeParse({ product, deliveries: participants.map(({ tonnes, address }) => ({ tonnes, address })) });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Lieferkosten konnten nicht berechnet werden.");
      setQuote(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Der Lieferkostenservice ist nicht erreichbar."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !enabled) return;
    setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const customers = participants.map((participant, index) => ({ ...participant, billingAddress: separateBilling[index] ? participant.billingAddress : participant.address }));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ product, participants: customers })));
      const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const saved = sessionStorage.getItem("streusalz-pending-request");
      if (!requestId.current && saved) {
        const previous = JSON.parse(saved);
        if (previous.signature === signature && typeof previous.id === "string") requestId.current = previous.id;
      }
      requestId.current ??= crypto.randomUUID();
      sessionStorage.setItem("streusalz-pending-request", JSON.stringify({ signature, id: requestId.current }));
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product, participants: customers,
          quoteToken: quote.token, requestId: requestId.current, legalVersion,
          businessAccepted: data.get("business") === "on", termsAccepted: data.get("terms") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Die Bestellung konnte nicht abgeschlossen werden.");
      sessionStorage.setItem("streusalz-receipt", JSON.stringify({ number: result.number, mailPending: result.mailPending }));
      sessionStorage.removeItem("streusalz-pending-request");
      router.push("/danke");
    } catch (error) { setError(error instanceof Error ? error.message : "Keine Verbindung. Bitte versuchen Sie es erneut. Dieselbe Anfrage wird nicht doppelt bestellt."); }
    finally { setBusy(false); }
  }
  const addressFields = (index: number, billing: boolean) => {
    const key = billing ? "billingAddress" : "address";
    const address = participants[index][key];
    return <>
      <label className="field field-full">{billing ? "Rechnungsanschrift" : "Lieferanschrift"}: Straße und Hausnummer<input autoComplete={billing ? "billing street-address" : "shipping street-address"} required maxLength={160} value={address.street} onChange={event => update(index, { [key]: { ...address, street: event.target.value } }, !billing)} /></label>
      <label className="field">Postleitzahl<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete={billing ? "billing postal-code" : "shipping postal-code"} value={address.postcode} onChange={event => update(index, { [key]: { ...address, postcode: event.target.value } }, !billing)} /></label>
      <label className="field">Ort<input required maxLength={160} autoComplete={billing ? "billing address-level2" : "shipping address-level2"} value={address.city} onChange={event => update(index, { [key]: { ...address, city: event.target.value } }, !billing)} /></label>
    </>;
  };
  return <div className="container checkout-layout"><form onSubmit={submit}>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <section className="panel"><p className="eyebrow">01 · GEBINDE & MENGE</p><h2>Was benötigen Sie?</h2><p>Eine Gebindeart pro Bestellung. Insgesamt volle Lkw-Ladungen à 23 Tonnen.</p><div className="product-options">{(Object.keys(PRODUCTS) as Product[]).map(key => <label className="product-option" key={key}><input type="radio" name="product" value={key} checked={product === key} onChange={() => { setProduct(key); setQuote(null); setEstimate(null); setEstimateError(""); requestId.current = null; }} /><b>{PRODUCTS[key].shortName}</b><span>{PRODUCTS[key].unit}</span><strong>{money(PRODUCTS[key].priceCents)} / t netto</strong></label>)}</div>
        {!isCommunity && <>
          <div className="field-grid">
            <label className="field">Menge in vollen Tonnen<input required type="number" min={23} step={23} value={participants[0].tonnes || ""} onChange={event => update(0, { tonnes: Number(event.target.value) }, true)} /><span className="field-help">23, 46, 69 … Tonnen · {product === "bags" ? `${total} Paletten · ${total * 40} Säcke` : `${total} BigBags`}</span></label>
            <label className="field">Liefer-PLZ für die Schätzung<input inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="shipping postal-code" value={participants[0].address.postcode} onChange={event => update(0, { address: { ...participants[0].address, postcode: event.target.value } }, true)} /></label>
          </div>
          <button type="button" className="button full-width" disabled={!validTotal || !/^\d{5}$/.test(participants[0].address.postcode)} onClick={estimateFreight}>Lieferkosten nach PLZ schätzen ↗</button>
          <p className="fine-print">Nur Ihre Liefer-PLZ genügt für eine erste, unverbindliche Kostenschätzung. Der verbindliche Lieferpreis wird vor der Bestellung anhand von Straße und Hausnummer berechnet.</p>
          {estimate && <div className="message message-info" role="status"><b>Unverbindliche PLZ-Schätzung: ca. {money(estimate.freightCents)} Lieferkosten netto</b><br />Für {estimate.totalTonnes} Tonnen nach {estimate.postcode}, zzgl. 19 % MwSt. Der endgültige Preis kann je nach Lieferanschrift abweichen.</div>}
          {estimateError && <div className="message message-error" role="alert">{estimateError}</div>}
        </>}
        <div className="summary-row"><span>Gesamtmenge</span><strong>{total} Tonnen · {validTotal ? `${total / 23} Lkw-Ladung${total === 23 ? "" : "en"}` : "Menge prüfen"}</strong></div>
        {!validTotal && <div className="message message-error" role="alert">Die Gesamtmenge muss 23, 46, 69 … Tonnen ergeben. {isCommunity ? "Bitte die Mengen der Lieferadressen anpassen." : "Bitte Ihre Bestellmenge anpassen."}</div>}
      </section>
      <section className="panel"><p className="eyebrow">{isCommunity ? "02 · UNTERNEHMEN & LIEFERADRESSEN" : "02 · RECHNUNGSEMPFÄNGER & LIEFERADRESSE"}</p><h2>{isCommunity ? "Ihre Bestellgemeinschaft" : "Ihr Unternehmen"}</h2><p>{isCommunity ? "Jedes Unternehmen erhält seine eigene Rechnung für den jeweiligen Mengen- und Frachtanteil." : "Sie bestellen für ein Unternehmen und erhalten eine Rechnung. Die Lieferanschrift gilt auch als Rechnungsanschrift, sofern Sie keine abweichende angeben."} Lieferung nur innerhalb Deutschlands.</p>
        {participants.map((participant, index) => <div className="participant-block" key={index}>
          <div className="participant-heading"><h3>{isCommunity ? `${String.fromCharCode(65 + index)} · Unternehmen & Lieferung` : "Rechnungsempfänger & Lieferung"}</h3>{index > 0 && <button type="button" className="button button-secondary button-small" onClick={() => removeParticipant(index)}>Entfernen</button>}</div>
          <div className="field-grid">
            <label className="field field-full">Firmenname<input required maxLength={160} autoComplete="organization" value={participant.company} onChange={event => update(index, { company: event.target.value })} /></label>
            <label className="field">Ansprechperson<input required maxLength={160} autoComplete="name" value={participant.contact} onChange={event => update(index, { contact: event.target.value })} /></label>
            {isCommunity && <label className="field">Menge in vollen Tonnen<input required type="number" min={1} step={1} value={participant.tonnes || ""} onChange={event => update(index, { tonnes: Number(event.target.value) }, true)} /><span className="field-help">{product === "bags" ? `${participant.tonnes} Paletten · ${participant.tonnes * 40} Säcke` : `${participant.tonnes} BigBags`}</span></label>}
            <label className="field">E-Mail für Rechnung & Lieferschein<input required type="email" maxLength={254} autoComplete="email" value={participant.email} onChange={event => update(index, { email: event.target.value })} /></label>
            <label className="field">Telefon für die Lieferabstimmung<input required type="tel" minLength={5} maxLength={40} autoComplete="tel" value={participant.phone} onChange={event => update(index, { phone: event.target.value })} /></label>
            {addressFields(index, false)}
            <label className="field field-full">USt-IdNr. (optional)<input maxLength={30} value={participant.vatId} onChange={event => update(index, { vatId: event.target.value })} /></label>
          </div>
          <label className="checkbox"><input type="checkbox" checked={!!separateBilling[index]} onChange={event => { setSeparateBilling(current => current.map((value, i) => i === index ? event.target.checked : value)); requestId.current = null; }} />Abweichende Rechnungsanschrift</label>
          {separateBilling[index] && <div className="field-grid">{addressFields(index, true)}</div>}
        </div>)}
        <details open={community || isCommunity}>
          <summary>Sonderfall: Gemeinschaftsbestellung mit weiteren Unternehmen</summary>
          <p>Optional können bis zu drei Unternehmen eine Ladung teilen. Pro Lieferadresse sind volle Tonnen möglich; alle Adressen müssen untereinander höchstens 20 Straßenkilometer auseinanderliegen. Jede Firma erhält ihre eigene Rechnung.</p>
          {participants.length < 3 && <button className="button button-secondary full-width" type="button" onClick={addParticipant}>+ Weiteres Unternehmen hinzufügen</button>}
        </details>
      </section>
      <section className="panel"><p className="eyebrow">03 · LIEFERKOSTEN & ABSCHLUSS</p><h2>Erst Klarheit. Dann bestellen.</h2><p>Die Straßenroute wird serverseitig berechnet. Jede 23-Tonnen-Ladung erhält eigene Transportkosten.{isCommunity && " Bei Gemeinschaften teilen wir die Fracht centgenau nach Tonnenanteil."}</p><button className="button full-width" type="button" disabled={!validTotal} onClick={calculate}>Lieferkosten verbindlich berechnen ↗</button>
        {quote && <div className="message message-info">Bitte prüfen Sie auch die erkannten Lieferadressen in der Preisübersicht. Die Kalkulation gilt 30 Minuten und nur am heutigen Bestelltag. Liefertermine sind voraussichtlich und unverbindlich.</div>}
        <label className="checkbox"><input name="business" type="checkbox" required /><span>{isCommunity ? "Ich bestelle ausschließlich gewerblich und bin zur Bestellung für alle angegebenen Unternehmen berechtigt. Alle Mengen und Lieferadressen sind mit den Teilnehmern abgestimmt." : "Ich bestelle ausschließlich gewerblich und bin zur Bestellung für das angegebene Unternehmen berechtigt."}</span></label>
        <label className="checkbox"><input name="terms" type="checkbox" required /><span>Ich akzeptiere die <Link href="/agb" target="_blank">AGB</Link> und stimme dem Versand von Rechnungen und Lieferscheinen als PDF per E-Mail zu. Die <Link href="/datenschutz" target="_blank">Datenschutzhinweise</Link>, auch zur Adressprüfung und Routenberechnung, habe ich gelesen.</span></label>
        <p className="fine-print">Kauf auf Rechnung. Zahlungsziel: 14 Tage nach tatsächlicher Lieferung. Nach Bestellung erhalten Sie eine Eingangsbestätigung; die Rechnung wird erst nach Lieferantenbestätigung manuell freigegeben. Lkw-Zufahrt und Entladung sind vorab abzustimmen.</p>
        <button type="submit" className="button full-width" disabled={!quote || !enabled}>{quote ? `Zahlungspflichtig bestellen · ${money(quote.quote.grossCents)}` : "Zahlungspflichtig bestellen"}</button>
        {!enabled && <div className="message message-info">Die Online-Bestellung ist in dieser Vorschau gesperrt. Wir beraten Sie gerne unter <a href="mailto:info@streusalz-grosshandel.de">info@streusalz-grosshandel.de</a>.</div>}
      </section>
    </fieldset>
    {busy && <p className="loading-label" role="status">Ihre Anfrage wird verarbeitet. Bitte warten …</p>}
    {error && <div className="message message-error" role="alert">{error}</div>}
  </form><aside className="panel quote-summary" aria-label="Preisübersicht" aria-live="polite"><p className="eyebrow">ALLES AUF EINEN BLICK</p><h2>Ihre Kalkulation</h2><div className="summary-row"><span>Gebinde</span><b>{PRODUCTS[product].shortName}</b></div><div className="summary-row"><span>Gesamtmenge</span><b>{total} t</b></div><div className="summary-row"><span>{isCommunity ? "Lieferadressen / Rechnungen" : "Lieferadresse / Rechnung"}</span><b>{participants.length}</b></div>
    {quote ? <><div className="summary-row"><span>Warenwert netto</span><b>{money(quote.quote.goodsCents)}</b></div><div className="summary-row"><span>Lieferkosten netto</span><b>{money(quote.quote.freightCents)}</b></div><div className="summary-row"><span>Gesamt netto</span><b>{money(quote.quote.netCents)}</b></div><div className="summary-row"><span>19 % MwSt.</span><b>{money(quote.quote.vatCents)}</b></div><div className="summary-row summary-total"><span>Gesamt brutto</span><b>{money(quote.quote.grossCents)}</b></div>
      {quote.quote.lines.map((line, index) => <div className="quote-line" key={index}><h3>{isCommunity && `${String.fromCharCode(65 + index)} · `}{participants[index].company || (isCommunity ? `Unternehmen ${index + 1}` : "Ihr Unternehmen")} · {line.tonnes} t</h3><p>{line.resolvedAddress}</p><div className="summary-row"><span>{isCommunity ? "Frachtanteil netto" : "Lieferkosten netto"}</span><b>{money(line.freightCents)}</b></div><div className="summary-row"><span>{isCommunity ? "Teilrechnung brutto" : "Rechnung brutto"}</span><b>{money(line.grossCents)}</b></div><p>Voraussichtliche Lieferung: <b>{displayDate(line.deliveryDate)}</b></p></div>)}
    </> : estimate && !isCommunity ? <div className="message message-info"><b>Unverbindliche PLZ-Schätzung</b><div className="summary-row"><span>Lieferkosten netto ca.</span><b>{money(estimate.freightCents)}</b></div><div className="summary-row"><span>Gesamt netto ca.</span><b>{money(estimate.netCents)}</b></div><div className="summary-row"><span>19 % MwSt. ca.</span><b>{money(estimate.vatCents)}</b></div><div className="summary-row"><span>Gesamt brutto ca.</span><b>{money(estimate.grossCents)}</b></div><p>Verbindlicher Preis erst nach Berechnung mit vollständiger Lieferadresse.</p></div> : <div className="message message-info">{isCommunity ? "Geben Sie Lieferadressen und Mengen ein" : "Geben Sie oben Ihre Liefer-PLZ und Bestellmenge ein"} und berechnen Sie Ihre Lieferkosten. Vorher ist der Endpreis noch offen.</div>}
    <p className="fine-print">Alle Produktpreise netto. Der Endpreis enthält Lieferkosten und 19 % MwSt. Nur für Gewerbetreibende.</p>
  </aside></div>;
}

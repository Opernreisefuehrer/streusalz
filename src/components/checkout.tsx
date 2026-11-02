"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCTS, money, displayDate, productLabel, type Product, type LoadItem } from "@/lib/catalog";
import { quoteInputSchema, type Participant } from "@/lib/validation";
import type { PostcodePrice, Quote } from "@/lib/pricing";

const emptyAddress = () => ({ street: "", postcode: "", city: "" });
const emptyParticipant = (tonnes: number): Participant => ({ company: "", contact: "", email: "", phone: "", vatId: "", tonnes, address: emptyAddress(), billingAddress: emptyAddress() });
export function Checkout({ initialProduct, community, enabled, legalVersion }: { initialProduct: Product; community: boolean; enabled: boolean; legalVersion: string }) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [loadItems, setLoadItems] = useState<LoadItem[]>();
  const [participants, setParticipants] = useState<Participant[]>(community ? [emptyParticipant(0), emptyParticipant(0), emptyParticipant(0)] : [emptyParticipant(23)]);
  const [separateBilling, setSeparateBilling] = useState<boolean[]>(community ? [false, false, false] : [false]);
  const [quote, setQuote] = useState<{ quote: Quote; token: string } | null>(null);
  const [postcodePrice, setPostcodePrice] = useState<{ price: PostcodePrice; token: string } | null>(null);
  const [priceError, setPriceError] = useState("");
  const [pricingBusy, setPricingBusy] = useState(false);
  const [priceRefresh, setPriceRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  const total = participants.reduce((sum, participant) => sum + participant.tonnes, 0);
  const isCommunity = participants.length > 1;
  const validTotal = Number.isSafeInteger(total) && total >= 23 && total % 23 === 0 && participants.every(participant => participant.tonnes > 0) && (!isCommunity || total === 23) && (!loadItems || loadItems.every(item => Number.isSafeInteger(item.tonnes) && item.tonnes >= 23 && item.tonnes % 23 === 0));
  const postcode = participants[0].address.postcode;
  const currentPrice = quote?.quote ?? (!isCommunity ? postcodePrice?.price : undefined);
  const sackPrice = currentPrice?.items?.find(item => item.product === "bags") ?? (product === "bags" && !loadItems && currentPrice ? { tonnes: total, netCents: currentPrice.netCents } : undefined);
  const priceInput = JSON.stringify({ product, postcode, tonnes: total, ...(loadItems ? { items: loadItems } : {}) });
  const canPrice = !isCommunity && validTotal && /^\d{5}$/.test(postcode);
  useEffect(() => {
    if (!canPrice) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPricingBusy(true);
      try {
        const response = await fetch("/api/postcode-price", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: priceInput, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Der aktuelle Preis konnte nicht berechnet werden.");
        if (!controller.signal.aborted) { setPostcodePrice(data); setPriceError(""); }
      } catch (error) {
        if (!controller.signal.aborted) setPriceError(error instanceof Error ? error.message : "Der Preisservice ist nicht erreichbar.");
      } finally {
        if (!controller.signal.aborted) setPricingBusy(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [priceInput, canPrice, priceRefresh]);
  function update(index: number, changes: Partial<Participant>, recalculate = false) {
    setParticipants(current => current.map((participant, i) => i === index ? { ...participant, ...changes } : participant));
    if (recalculate) {
      setQuote(null);
      if ((changes.tonnes !== undefined && changes.tonnes !== participants[index].tonnes) || (changes.address && changes.address.postcode !== participants[index].address.postcode)) {
        setPostcodePrice(null); setPriceError(""); setPricingBusy(false);
      }
    }
    requestId.current = null;
  }
  function addParticipant() {
    if (participants.length >= 3 || loadItems) return;
    setParticipants(current => [...current, emptyParticipant(0)]);
    setSeparateBilling(current => [...current, false]);
    setQuote(null); setPostcodePrice(null); setPriceError(""); setPricingBusy(false); requestId.current = null;
  }
  function configureLoads(items: LoadItem[]) {
    setLoadItems(items);
    update(0, { tonnes: items.reduce((sum, item) => sum + item.tonnes, 0) }, true);
    setQuote(null); setPostcodePrice(null); setPriceError(""); setPricingBusy(false);
  }
  function removeParticipant(index: number) {
    setParticipants(current => current.filter((_, i) => i !== index).map((participant, i) => i === 0 ? { ...participant, tonnes: participant.tonnes + current[index].tonnes } : participant));
    setSeparateBilling(current => current.filter((_, i) => i !== index));
    setQuote(null); setPostcodePrice(null); setPriceError(""); setPricingBusy(false); requestId.current = null;
  }
  async function calculate() {
    setError(""); setQuote(null);
    const input = quoteInputSchema.safeParse({ product, ...(loadItems ? { items: loadItems } : {}), deliveries: participants.map(({ tonnes, address }) => ({ tonnes, address })) });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input.data, ...(!isCommunity && postcodePrice ? { postcodePriceToken: postcodePrice.token } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Der Gesamtpreis konnte nicht bestätigt werden.");
      setQuote(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Der Preisservice ist nicht erreichbar."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !enabled) return;
    setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const customers = participants.map((participant, index) => ({ ...participant, billingAddress: separateBilling[index] ? participant.billingAddress : participant.address }));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ product, ...(loadItems ? { items: loadItems } : {}), participants: customers })));
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
          product, ...(loadItems ? { items: loadItems } : {}), participants: customers,
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
      <label className="field">Postleitzahl<input id={isCommunity && index === 0 && !billing ? "liefer-plz" : undefined} required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete={billing ? "billing postal-code" : "shipping postal-code"} value={address.postcode} onChange={event => update(index, { [key]: { ...address, postcode: event.target.value } }, !billing)} /></label>
      <label className="field">Ort<input required maxLength={160} autoComplete={billing ? "billing address-level2" : "shipping address-level2"} value={address.city} onChange={event => update(index, { [key]: { ...address, city: event.target.value } }, !billing)} /></label>
    </>;
  };
  return <div className="container checkout-layout"><form onSubmit={submit}>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <section className="panel"><p className="eyebrow">01 · MENGE & PREIS</p><h2>Was benötigen Sie?</h2><p>Je Lkw-Ladung (23 t) eine Gebindeart. Mehrere Ladungen mit unterschiedlichen Gebindearten sind in einer Bestellung möglich.</p><div className="product-options">{(Object.keys(PRODUCTS) as Product[]).map(key => <label className="product-option" key={key}><input type="radio" name="product" value={key} checked={!loadItems && product === key} onChange={() => { setProduct(key); setLoadItems(undefined); setQuote(null); setPostcodePrice(null); setPriceError(""); setPricingBusy(false); requestId.current = null; }} /><b>{PRODUCTS[key].shortName}</b><span>{PRODUCTS[key].unit}</span><strong>Preis inkl. Lieferung</strong></label>)}<label className="product-option"><input type="radio" name="product" value="mixed" checked={!!loadItems} disabled={isCommunity} onChange={() => configureLoads([{ product: "bigbag", tonnes: Math.max(46, validTotal ? total : 46) - 23 }, { product: "bags", tonnes: 23 }])} /><b>Mehrere Gebindearten</b><span>Je Lkw eine Gebindeart</span><strong>Ab 2 Lkw-Ladungen</strong></label></div>
        {!isCommunity && <>
          <div className="field-grid">
            {loadItems ? loadItems.map(item => <label className="field" key={item.product}>{PRODUCTS[item.product].shortName}: Menge in Tonnen<input required type="number" min={23} step={23} value={item.tonnes || ""} onChange={event => configureLoads(loadItems.map(current => current.product === item.product ? { ...current, tonnes: Number(event.target.value) } : current))} /><span className="field-help">{item.tonnes / 23} Lkw-Ladungen · {item.product === "bags" ? `${item.tonnes} Paletten · ${item.tonnes * 40} Säcke` : `${item.tonnes} BigBags`}</span></label>) : <label className="field">Menge in vollen Tonnen<input required type="number" min={23} step={23} value={participants[0].tonnes || ""} onChange={event => update(0, { tonnes: Number(event.target.value) }, true)} /><span className="field-help">23, 46, 69 … Tonnen · {product === "bags" ? `${total} Paletten · ${total * 40} Säcke` : `${total} BigBags`}</span></label>}
            <label className="field">Liefer-PLZ<input id="liefer-plz" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="shipping postal-code" value={postcode} onChange={event => update(0, { address: { ...participants[0].address, postcode: event.target.value } }, true)} /></label>
          </div>
          {loadItems && <p className="fine-print">Beispiel: 23 t BigBags + 23 t 25-kg-Sackware = 46 t in einer Bestellung, geliefert mit zwei Lkw. Sie erhalten eine gemeinsame Rechnung.</p>}
          <button type="button" className="button full-width" disabled={!validTotal || !/^\d{5}$/.test(postcode) || pricingBusy} onClick={() => { setQuote(null); setPostcodePrice(null); setPriceError(""); setPriceRefresh(current => current + 1); }}>Aktuellen Preis anzeigen ↗</button>
          <p className="fine-print">PLZ eingeben – Ihr aktueller Preis inklusive Lieferung erscheint automatisch. Der Preis gilt für die gewählte Menge und Gebindeart 30 Minuten, längstens bis zum Tageswechsel. Straße und Hausnummer innerhalb derselben PLZ ändern ihn nicht. PLZ-Koordinaten: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).</p>
          {pricingBusy && <p role="status">Ihr aktueller Preis wird berechnet …</p>}
          {postcodePrice && <div className="message message-success price-success" role="status"><b>Aktueller Preis inkl. Lieferung: {money(postcodePrice.price.netCents)} netto</b><br />Gesamtpreis für {total} Tonnen nach {postcode}, zzgl. 19 % MwSt.</div>}
          {priceError && <div className="message message-error" role="alert">{priceError}</div>}
        </>}
        <div className="summary-row"><span>Gesamtmenge</span><strong>{total} Tonnen · {validTotal ? `${total / 23} Lkw-Ladung${total === 23 ? "" : "en"}` : "Menge prüfen"}</strong></div>
        {!validTotal && <div className="message message-error" role="alert">{isCommunity ? "Eine Gemeinschaftsbestellung teilt genau 23 Tonnen einer Gebindeart. Bitte für jeden Teilnehmer eine positive Teilmenge angeben." : "Je Gebindeart sind volle 23-Tonnen-Ladungen erforderlich: 23, 46, 69 … Tonnen. Bitte Ihre Bestellmenge anpassen."}</div>}
      </section>
      <section className="panel"><p className="eyebrow">{isCommunity ? "02 · AUFTRAGGEBER & LIEFERADRESSEN" : "02 · RECHNUNGSEMPFÄNGER & LIEFERADRESSE"}</p><h2>{isCommunity ? "Ihre Bestellgemeinschaft" : "Ihr Unternehmen oder Ihre Einrichtung"}</h2><p>{isCommunity ? "Jeder Auftraggeber erhält seine eigene Rechnung für seinen Gesamtpreis inklusive Lieferung." : "Sie bestellen für ein Unternehmen oder einen öffentlichen Auftraggeber und erhalten eine Rechnung. Die Lieferanschrift gilt auch als Rechnungsanschrift, sofern Sie keine abweichende angeben."} Lieferung nur innerhalb Deutschlands.</p>
        {participants.map((participant, index) => <div className="participant-block" key={index}>
          <div className="participant-heading"><h3>{isCommunity ? `${String.fromCharCode(65 + index)} · Auftraggeber & Lieferung` : "Rechnungsempfänger & Lieferung"}</h3>{index > 0 && <button type="button" className="button button-secondary button-small" onClick={() => removeParticipant(index)}>Entfernen</button>}</div>
          <div className="field-grid">
            <label className="field field-full">Name des Unternehmens / der Einrichtung<input required maxLength={160} autoComplete="organization" value={participant.company} onChange={event => update(index, { company: event.target.value })} /></label>
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
          <summary>Sonderfall: Gemeinschaftsbestellung mit weiteren Auftraggebern</summary>
          <p>Bis zu drei Auftraggeber teilen eine 23-Tonnen-Ladung einer Gebindeart. Geben Sie die Teilmenge je Teilnehmer in vollen Tonnen selbst an. Alle Adressen müssen untereinander höchstens 20 Straßenkilometer auseinanderliegen. Jeder Auftraggeber erhält seine eigene Rechnung.</p>
          {loadItems && <p className="message message-info">Für eine Gemeinschaftsbestellung wählen Sie bitte eine einzelne Gebindeart. Mehrere unterschiedlich beladene Lkw sind als Einzelbestellung mit einer Lieferadresse möglich.</p>}
          {participants.length < 3 && <button className="button button-secondary full-width" type="button" disabled={!!loadItems} onClick={addParticipant}>+ Weiteren Auftraggeber hinzufügen</button>}
        </details>
      </section>
      <section className="panel"><p className="eyebrow">03 · PREIS & ABSCHLUSS</p><h2>Erst Klarheit. Dann bestellen.</h2><p>{isCommunity ? "Ihr Gesamtpreis enthält die Lieferung an alle angegebenen Adressen. Jeder Auftraggeber sieht seinen eigenen Rechnungsbetrag." : "Die Lieferadresse wird vor Abschluss geprüft. Ihr angezeigter PLZ-Preis inklusive Lieferung bleibt bei gleicher Menge und Gebindeart unverändert."}</p><button className="button full-width" type="button" disabled={!validTotal || pricingBusy} onClick={calculate}>Lieferadresse prüfen & Gesamtpreis bestätigen ↗</button>
        {quote && <div className="message message-info">Bitte prüfen Sie auch die erkannten Lieferadressen in der Preisübersicht. Der Preis gilt 30 Minuten ab Preisabruf, längstens bis zum Tageswechsel; die Adressprüfung verlängert diese Frist nicht. Liefertermine sind voraussichtlich und unverbindlich.</div>}
        <label className="checkbox"><input name="business" type="checkbox" required /><span>{isCommunity ? "Ich bestelle ausschließlich für Unternehmen oder öffentliche Auftraggeber und bin zur Bestellung für alle angegebenen Auftraggeber berechtigt. Alle Mengen und Lieferadressen sind mit den Teilnehmern abgestimmt." : "Ich bestelle für ein Unternehmen oder einen öffentlichen Auftraggeber und bin zur Bestellung für den angegebenen Auftraggeber berechtigt. Ich bestelle nicht als Privatkunde."}</span></label>
        <label className="checkbox"><input name="terms" type="checkbox" required /><span>Ich akzeptiere die <Link href="/agb" target="_blank">AGB</Link> und stimme dem Versand von Rechnungen und Lieferscheinen als PDF per E-Mail zu. Die <Link href="/datenschutz" target="_blank">Datenschutzhinweise</Link>, auch zur Adressprüfung und Routenberechnung, habe ich gelesen.</span></label>
        <p className="fine-print">Kauf auf Rechnung. Zahlungsziel: 14 Tage nach tatsächlicher Lieferung. Zahlbar ohne Abzug. Kein Skonto. Nach Bestellung erhalten Sie eine Eingangsbestätigung; die Rechnung wird erst nach Lieferantenbestätigung manuell freigegeben. Lkw-Zufahrt und Entladung sind vorab abzustimmen.</p>
        <button type="submit" className="button full-width" disabled={!quote || !enabled}>{quote ? `Zahlungspflichtig bestellen · ${money(quote.quote.grossCents)}` : "Zahlungspflichtig bestellen"}</button>
        {!enabled && <div className="message message-info">Die Online-Bestellung ist in dieser Vorschau gesperrt. Wir beraten Sie gerne unter <a href="mailto:info@streusalz-grosshandel.de">info@streusalz-grosshandel.de</a>.</div>}
      </section>
    </fieldset>
    {busy && <p className="loading-label" role="status">Ihre Anfrage wird verarbeitet. Bitte warten …</p>}
    {error && <div className="message message-error" role="alert">{error}</div>}
  </form><aside className={`panel quote-summary${currentPrice ? " message-success price-success" : ""}`} aria-label="Preisübersicht" aria-live="polite"><p className="eyebrow">ALLES AUF EINEN BLICK</p><h2>Aktueller Preis inkl. Lieferung</h2><div className="summary-row"><span>Gebinde</span><b>{productLabel(product, loadItems)}</b></div><div className="summary-row"><span>Gesamtmenge</span><b>{total} t</b></div><div className="summary-row"><span>{isCommunity ? "Lieferadressen / Rechnungen" : "Lieferadresse / Rechnung"}</span><b>{participants.length}</b></div>
    <div className="summary-row"><span>Pro Tonne netto inkl. Lieferung{loadItems && " (Durchschnitt)"}</span><b>{currentPrice ? money(currentPrice.netCents / total) : isCommunity ? "Adressen prüfen" : "PLZ eingeben"}</b></div>
    {loadItems?.map(item => { const priced = currentPrice?.items?.find(entry => entry.product === item.product); return <div className="summary-row" key={item.product}><span>{item.tonnes} t {PRODUCTS[item.product].shortName} · pro Tonne netto inkl. Lieferung</span><b>{priced ? money(priced.netCents / priced.tonnes) : "PLZ eingeben"}</b></div>; })}
    {(product === "bags" || loadItems) && <div className="summary-row"><span>Pro 25-kg-Sack netto inkl. Lieferung</span><b>{sackPrice ? money(sackPrice.netCents / (sackPrice.tonnes * 40)) : isCommunity ? "Adressen prüfen" : "PLZ eingeben"}</b></div>}
    {quote ? <><div className="summary-row"><span>Gesamt netto inkl. Lieferung</span><b>{money(quote.quote.netCents)}</b></div><div className="summary-row"><span>19 % MwSt.</span><b>{money(quote.quote.vatCents)}</b></div><div className="summary-row summary-total"><span>Gesamt brutto inkl. Lieferung</span><b>{money(quote.quote.grossCents)}</b></div>
      {quote.quote.lines.map((line, index) => <div className="quote-line" key={index}><h3>{isCommunity && `${String.fromCharCode(65 + index)} · `}{participants[index].company || (isCommunity ? `Auftraggeber ${index + 1}` : "Ihr Unternehmen / Ihre Einrichtung")} · {line.tonnes} t</h3><p>{line.resolvedAddress}</p><div className="summary-row"><span>{isCommunity ? "Teilrechnung brutto inkl. Lieferung" : "Rechnung brutto inkl. Lieferung"}</span><b>{money(line.grossCents)}</b></div><p>Voraussichtliche Lieferung: <b>{displayDate(line.deliveryDate)}</b></p></div>)}
    </> : postcodePrice && !isCommunity ? <><div className="summary-row"><span>Gesamt netto inkl. Lieferung</span><b>{money(postcodePrice.price.netCents)}</b></div><div className="summary-row"><span>19 % MwSt.</span><b>{money(postcodePrice.price.vatCents)}</b></div><div className="summary-row summary-total"><span>Gesamt brutto inkl. Lieferung</span><b>{money(postcodePrice.price.grossCents)}</b></div></> : <div className="message message-info">{isCommunity ? "Geben Sie Lieferadressen und Mengen ein und berechnen Sie Ihren Gesamtpreis inklusive Lieferung." : "Geben Sie im Bestellformular Ihre Liefer-PLZ ein. Ihr aktueller Preis inklusive Lieferung erscheint automatisch."}</div>}
    <p className="fine-print">Alle Preise inklusive Lieferung. Nettopreise zzgl. 19 % MwSt.; der Bruttobetrag enthält die Umsatzsteuer. Einzelpreise sind auf Cent gerundet; maßgeblich ist der Gesamtpreis. Nur für Gewerbetreibende und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden.</p>
  </aside></div>;
}

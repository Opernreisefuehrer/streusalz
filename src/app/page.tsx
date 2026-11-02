import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { seller, siteUrl } from "@/lib/config";
import { PackageArt } from "@/components/package-art";

export const metadata: Metadata = { alternates: { canonical: "/" } };
const faqs = [
  ["Wer kann im Shop bestellen?", "Nur Gewerbetreibende und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden."],
  ["Wie viel Streusalz kann ich bestellen?", "Die Mindestbestellmenge beträgt 23 Tonnen. Weitere Mengen bestellen Sie in 23-Tonnen-Schritten: 46, 69, 92 Tonnen und so weiter. Der angezeigte aktuelle Gesamtpreis enthält die Lieferung für die gewählte Menge."],
  ["Wie funktioniert eine Gemeinschaftsbestellung?", "Bis zu drei Unternehmen oder öffentliche Auftraggeber teilen genau eine 23-Tonnen-Ladung einer Gebindeart. Sie geben die Teilmenge je Teilnehmer in vollen Tonnen selbst an. Beispiel: 10 t + 8 t + 5 t = 23 t. Alle Adressen müssen untereinander höchstens 20 Straßenkilometer auseinanderliegen. Jeder Auftraggeber erhält seinen eigenen Rechnungsbetrag inklusive Lieferung."],
  ["Ist die Lieferung im Preis enthalten?", "Ja. Gebinde und Menge wählen, Liefer-PLZ eingeben: Sie sehen Ihren aktuellen Gesamtpreis inklusive Lieferung. Bei einer Bestellung für einen Auftraggeber bleibt dieser Preis innerhalb derselben PLZ auch nach Angabe von Straße und Hausnummer gleich. Nettopreis, 19 % MwSt. und Bruttobetrag werden klar ausgewiesen. Für Gemeinschaftsbestellungen wird der Gesamtpreis mit allen Lieferadressen berechnet."],
  ["Wann wird geliefert und wann muss ich bezahlen?", "Der voraussichtliche Liefertermin liegt fünf Werktage nach der Bestellung. Wir rechnen Montag bis Freitag und berücksichtigen gesetzliche Feiertage des Bundeslandes. Lokale Sonderfeiertage prüfen wir bei der Auftragsfreigabe. Sie kaufen auf Rechnung; das Zahlungsziel beträgt 14 Tage nach der tatsächlichen Lieferung. Zahlbar ohne Abzug. Kein Skonto."],
  ["Kann ich Sackware und BigBags kombinieren?", "Ja, in getrennten Lkw-Ladungen innerhalb einer Bestellung an eine Lieferadresse. Je Lkw werden 23 Tonnen einer Gebindeart geladen. Beispiel: 23 t BigBags + 23 t 25-kg-Sackware = 46 t mit zwei Lkw und einer Rechnung. Gemeinschaftsbestellungen teilen dagegen eine 23-Tonnen-Ladung einer Gebindeart."],
  ["Was muss ich bei der Anlieferung beachten?", "Bitte stellen Sie eine für schwere Lkw zugängliche Zufahrt und geeignete Entlademöglichkeiten bereit. Besondere Zufahrtsbedingungen und die Entladung stimmen wir vorab mit Ihnen ab. Beachten Sie außerdem örtliche Regelungen zum Einsatz von Streusalz."],
];
export default function Home() {
  const company = seller();
  const structuredData = {
    "@context": "https://schema.org", "@type": "Organization", name: "Streusalz Großhandel",
    url: siteUrl(), email: company.email,
    address: { "@type": "PostalAddress", streetAddress: company.street, postalCode: company.postcode, addressLocality: company.city, addressCountry: "DE" },
  };
  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="hero">
        <Image src="/images/streusalz-logistik-verbund.webp" alt="BigBags mit feinkörnigem Streusalz und eine volle 1-Tonnen-Palette mit 40 Säcken à 25 kg in versetzten Lagen – KI-generierte Illustration, keine Produktfotografie" fill priority sizes="100vw" className="hero-image" />
        <div className="hero-shade" />
        <div className="container hero-content">
          <p className="eyebrow"><span className="dot" /> IHR WINTERVORRAT. PROFESSIONELL GEPLANT.</p>
          <h1>Der Winter kommt.<br /><span>Sie sind bereit.</span></h1>
          <p className="hero-copy">Streusalz Großhandel für Profis: BigBags und Sackware in großen Mengen. Bundesweit geliefert. Transparent kalkuliert. Auf Rechnung.</p>
          <div className="hero-actions"><Link href="/bestellen" className="button">Preis inkl. Lieferung <span aria-hidden="true">↗</span></Link><a href="#produkte" className="button button-glass">Produkte entdecken <span aria-hidden="true">↓</span></a></div>
          <div className="hero-facts"><span><b>23 t</b> ab einer Lkw-Ladung</span><span><b>5 Werktage</b> voraussichtliche Lieferzeit</span><span><b>14 Tage</b> Zahlungsziel nach Lieferung</span></div>
        </div>
        <span className="image-note">Illustrative Darstellung</span>
      </section>
      <div className="benefit-strip"><div className="container"><span><i aria-hidden="true">↗</i> Bundesweite Lieferung</span><span><i aria-hidden="true">▦</i> Klare Preise</span><span><i aria-hidden="true">✓</i> Kauf auf Rechnung</span><span><i aria-hidden="true">↔</i> Gemeinsam günstiger teilen</span></div></div>
      <section className="section container" id="produkte">
        <div className="section-heading"><div><p className="eyebrow">ZWEI GEBINDE. EIN KLARES ZIEL.</p><h2>Das richtige Salz.<br />Für Ihren Einsatz.</h2></div><p>Für Winterdienste, Unternehmen und öffentliche Auftraggeber wie Städte und Gemeinden. Wählen Sie Ihre Gebindeart — wir kümmern uns um die Kalkulation.</p></div>
        <div className="product-grid">
          <article className="product-card"><div className="product-visual"><span className="tag">Für große Flächen</span><PackageArt kind="bigbag" /><span className="visual-caption">Technische Illustration · nicht maßstabsgetreu</span></div><div className="product-body"><p className="eyebrow">EFFIZIENT IN GROSSEN MENGEN</p><h3>Streusalz im BigBag</h3><p>Eine Tonne pro BigBag. Die kompakte Wahl für Ihren professionellen Winterdienst.</p><ul className="check-list"><li>1.000 kg je BigBag</li><li>Ab 23 BigBags pro Bestellung</li><li>Für Lagerung und maschinellen Einsatz</li></ul><div className="price-row"><div><strong>Ihr Preis</strong><span>inkl. Lieferung nach PLZ</span></div><Link href="/bestellen?produkt=bigbag" className="round-link" aria-label="BigBags bestellen">↗</Link></div><p className="price-note">PLZ eingeben und aktuellen Gesamtpreis erhalten. Nettopreis zzgl. 19 % MwSt.</p></div></article>
          <article className="product-card"><div className="product-visual product-visual-blue"><span className="tag">Flexibel im Einsatz</span><PackageArt kind="bags" /><span className="visual-caption">Technische Illustration · nicht maßstabsgetreu</span></div><div className="product-body"><p className="eyebrow">HANDLICH UND PALETTIERT</p><h3>25-kg-Sackware</h3><p>Einfach verteilen, einfach bevorraten. 40 Säcke auf jeder 1-Tonnen-Palette.</p><ul className="check-list"><li>40 × 25 kg je Palette</li><li>Ab 23 Paletten pro Bestellung</li><li>Ideal für mehrere Einsatzorte</li></ul><div className="price-row"><div><strong>Ihr Preis</strong><span>inkl. Lieferung nach PLZ</span></div><Link href="/bestellen?produkt=bags" className="round-link" aria-label="Sackware bestellen">↗</Link></div><p className="price-note">PLZ eingeben und aktuellen Gesamtpreis erhalten. Nettopreis zzgl. 19 % MwSt.</p></div></article>
        </div>
        <p className="fine-print">Nur für Gewerbetreibende und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden. Je Lkw 23 Tonnen einer Gebindeart; mehrere unterschiedlich beladene Lkw sind in einer Bestellung möglich.</p>
      </section>
      <section className="community section" id="gemeinschaft"><div className="container community-grid"><div><p className="eyebrow">GEMEINSAM VORAUSDENKEN</p><h2>Keine 23 Tonnen nötig?<br /><span>Teilen Sie sich die Ladung.</span></h2><p>Teilen Sie eine 23-Tonnen-Ladung einer Gebindeart mit bis zu drei Auftraggebern. Die Teilmengen geben Sie selbst an. Bis zu drei Lieferadressen und separate Rechnungen; jeder erhält seinen eigenen Gesamtpreis inklusive Lieferung.</p><Link href="/bestellen?gemeinschaft=1" className="button">Gemeinschaftsbestellung planen <span aria-hidden="true">↗</span></Link></div><div className="community-diagram" aria-label="Beispiel: 10, 8 und 5 Tonnen ergeben 23 Tonnen"><div className="diagram-label">BEISPIEL: EINE LADUNG, DREI PARTNER.</div><div className="diagram-truck"><span aria-hidden="true">▦</span><b>23 TONNEN</b><small>eine gemeinsame Bestellung</small></div><div className="diagram-lines" /><div className="diagram-stops"><div><span>A</span><b>10 t</b><small>Auftraggeber 1</small></div><div><span>B</span><b>8 t</b><small>Auftraggeber 2</small></div><div><span>C</span><b>5 t</b><small>Auftraggeber 3</small></div></div><p>Beispielhafte Mengenaufteilung · max. 20 Straßenkilometer zwischen allen Lieferadressen</p></div></div></section>
      <section className="section container" id="ablauf"><div className="section-heading"><div><p className="eyebrow">VOM BEDARF BIS ZUR LIEFERUNG</p><h2>Einfach bestellt.<br />Sauber abgewickelt.</h2></div><p>Kein Rätselraten bei den Kosten. Kein Bezahlen im Voraus. Ein klarer Ablauf für Ihr Unternehmen.</p></div><div className="steps-grid">{[
        ["01", "Bedarf & Adresse", "Gebinde, volle Tonnen und Lieferadresse wählen. Bei Bedarf bis zu zwei Partner ergänzen."],
        ["02", "Preis & Bestellung", "Gesamtpreis inklusive Lieferung prüfen. Gewerbliche Bestellung verbindlich absenden."],
        ["03", "Bestätigung & Rechnung", "Wir stimmen die Lieferung mit Ihnen ab. Anschließend erhalten Sie Ihre Auftragsbestätigung und Rechnung per E-Mail."],
        ["04", "Lieferung & Dokumente", "Lieferschein per E-Mail. Die Zahlung wird 14 Tage nach der tatsächlichen Lieferung fällig."],
      ].map(([number, title, copy]) => <article className="step" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="knowledge section" id="wissen"><div className="container knowledge-grid"><div><p className="eyebrow">STREUSALZ & AUFTAUSALZ</p><h2>Streusalz für Wege,<br />Einfahrten und Straßen.</h2><p>Streusalz wirkt bei Eis und Schnee abtauend. Die Salzlösung senkt den Gefrierpunkt des Wassers. Die Wirksamkeit hängt unter anderem von Temperatur, Dosierung und Witterung ab.</p><p>Planen Sie Ihren Wintervorrat frühzeitig. Lagern Sie Streusalz trocken und geschützt und beachten Sie die örtlichen Vorschriften für dessen Einsatz.</p></div><div className="spec-card"><h3>Produktwissen auf einen Blick</h3><dl><div><dt>Salztyp</dt><dd>Steinsalz · Natriumchlorid (NaCl)</dd></div><div><dt>Lieferantenspezifikation</dt><dd>mind. 96 % NaCl · 0,1–5 mm</dd></div><div><dt>Gebinde</dt><dd>1-t-BigBag oder 25-kg-Säcke</dd></div><div><dt>Sackware</dt><dd>40 Säcke pro Palette</dd></div><div><dt>Liefergebiet</dt><dd>Deutschland</dd></div></dl><p className="fine-print">Angaben gemäß aktueller Lieferantenbestätigung. Die Eignung nach geltender TL Streu wird vor der Auftragsfreigabe geprüft.</p></div></div></section>
      <section className="section container faq-section" id="faq"><div><p className="eyebrow">KLARE ANTWORTEN</p><h2>Gut vorbereitet.<br />Gut informiert.</h2><p>Ihre Frage ist nicht dabei?</p><a className="text-link" href={`mailto:${company.email}`}>Sprechen Sie mit uns ↗</a></div><div>{faqs.map(([question, answer]) => <details className="faq" key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="contact-cta"><div className="container"><div><p className="eyebrow">Der nächste Winter kommt bestimmt.</p><h2>Ihr Vorrat beginnt hier.</h2><p>Gebinde wählen. Preis inklusive Lieferung erhalten. Auf Rechnung bestellen.</p></div><Link className="button" href="/bestellen">Jetzt Bestellung planen <span aria-hidden="true">↗</span></Link></div></section>
    </main>
  );
}

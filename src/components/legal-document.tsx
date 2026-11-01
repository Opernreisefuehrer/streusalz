import type { LegalDocument as Document } from "@/lib/legal";
import { seller, privacySettings } from "@/lib/config";
import { legalReleasePending } from "@/lib/legal";

export function LegalDocument({ document, privacy = false }: { document: Document; privacy?: boolean }) {
  const email = privacy ? privacySettings().contactEmail : seller().email;
  return <main id="main" className="container legal-page">
    <header className="legal-heading"><p className="eyebrow">{privacy ? "TRANSPARENZ & IHRE RECHTE" : "KLARE REGELN FÜR GEWERBLICHE BESTELLUNGEN"}</p><h1>{document.title}</h1><p>Stand: {document.date} · Streusalz Großhandel · Nur für Gewerbetreibende</p><a className="text-link" href={`mailto:${email}`}>{email} ↗</a></header>
    {legalReleasePending() && <div className="message message-info" role="status">Ausgearbeitete Fassung für den vorgesehenen Shopbetrieb. Die Betreiberfreigabe steht aus; insbesondere sind die tatsächlichen Datenbank-/Mailanbieter, Protokollfristen und Datenschutzvereinbarungen vor dem Livebetrieb zu ergänzen und zu prüfen. Online-Bestellungen bleiben gesperrt.</div>}
    <div className="legal-grid"><nav className="legal-navigation" aria-label="Inhaltsverzeichnis"><h2>Inhalt</h2>{document.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.heading}</a>)}</nav><article className="legal-article">{document.sections.map(section => <section id={section.id} key={section.id}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{section.links && <ul>{section.links.map(link => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a></li>)}</ul>}</section>)}</article></div>
  </main>;
}

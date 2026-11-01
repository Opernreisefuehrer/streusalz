import type { Metadata } from "next";
import { seller } from "@/lib/config";
export const metadata: Metadata = { title: "Impressum", alternates: { canonical: "/impressum" } };
export default function Imprint() {
  const company = seller();
  return <main id="main" className="container legal-content"><p className="eyebrow">ANBIETERKENNZEICHNUNG</p><h1>Impressum</h1><h2>Streusalz Großhandel</h2><p>{company.name}<br />{company.street}<br />{company.postcode} {company.city}<br />Deutschland</p><h2>Kontakt</h2><p>Telefon: {company.phone}<br /><a href={`mailto:${company.email}`}>{company.email}</a></p>{company.taxId && <><h2>Steuerliche Angabe</h2><p>{company.taxId}</p></>}<p className="fine-print">Die Kontaktdaten wurden aus der bisherigen Website übernommen. Vor der Live-Freischaltung sind die vollständige Anbieterkennzeichnung und gegebenenfalls erforderliche Register-/Umsatzsteuerangaben zu prüfen.</p></main>;
}

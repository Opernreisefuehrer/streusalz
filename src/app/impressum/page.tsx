import type { Metadata } from "next";
import { seller, privacySettings } from "@/lib/config";

export const metadata: Metadata = { title: "Impressum", alternates: { canonical: "/impressum" } };
export default function Imprint() {
  const company = seller();
  const privacy = privacySettings();
  return <main id="main" className="container legal-content">
    <p className="eyebrow">ANGABEN NACH § 5 DDG</p><h1>Impressum</h1>
    <h2>Streusalz Großhandel</h2><p>Inhaber: {company.name}<br />Einzelunternehmer<br />{company.street}<br />{company.postcode} {company.city}<br />Deutschland</p>
    <h2>Kontakt</h2><p>Telefon: <a href={`tel:+49${company.phone.replace(/^0/, "").replace(/\D/g, "")}`}>{company.phone}</a><br />E-Mail: <a href={`mailto:${company.email}`}>{company.email}</a></p>
    <h2>Register</h2><p>Der Anbieter ist nicht im Handelsregister eingetragen.</p>
    {company.vatId && <><h2>Umsatzsteuer-Identifikationsnummer</h2><p>USt-IdNr. nach § 27a UStG: {company.vatId}</p></>}
    {company.economicId && <><h2>Wirtschafts-Identifikationsnummer</h2><p>W-IdNr. nach § 139c AO: {company.economicId}</p></>}
    <h2>Datenschutzkontakt</h2><p><a href={`mailto:${privacy.contactEmail}`}>{privacy.contactEmail}</a></p>
    <h2>Kundenkreis</h2><p>Dieser Shop richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden. Es werden keine Verbraucherverträge angeboten.</p>
    <h2>Bildnachweise</h2><p>Das Startseitenmotiv ist eine für diesen Shop erstellte KI-generierte Illustration. Gebinde- und Logoillustrationen sind eigens erstellte SVG-Grafiken. Die Darstellungen sind keine Produktfotografien und keine verbindliche Zusicherung von Verpackungsdetails.</p>
  </main>;
}

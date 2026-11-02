import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { seller, siteUrl, isLiveReady, isSiteIndexable } from "@/lib/config";
import { MobileMenu } from "@/components/mobile-menu";
import { PriceCalculatorLink } from "@/components/price-calculator-link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Streusalz Großhandel", template: "%s | Streusalz Großhandel" },
  description: "Streusalz für Wege, Einfahrten und Straßen: BigBags und 25-kg-Säcke ab 23 Tonnen. Bundesweite Lieferung auf Rechnung für Gewerbe, Städte und Gemeinden.",
  openGraph: { locale: "de_DE", type: "website", siteName: "Streusalz Großhandel", images: [{ url: "/images/streusalz-logistik-verbund.webp", width: 1671, height: 941, alt: "Feinkörniges Streusalz im BigBag und Sackware in versetzten Lagen – illustrative Darstellung" }] },
  robots: isSiteIndexable() ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const company = seller();
  return (
    <html lang="de">
      <body>
        <a className="skip-link" href="#main">Zum Inhalt springen</a>
        <div className="topbar"><div className="container"><span>Direkt vom Großhändler · Bundesweite Lieferung · Faire Preise</span></div></div>
        <header className="site-header"><div className="container header-inner">
          <Link href="/" className="brand" aria-label="Streusalz Großhandel Startseite"><Image className="brand-icon" src="/images/streusalz-logo.png" alt="" width={80} height={41} unoptimized /><span className="brand-copy"><span className="brand-domain">STREUSALZ-<wbr />GROSSHANDEL.DE</span><span className="brand-tagline">25-kg-Säcke · BigBags</span></span></Link>
          <nav aria-label="Hauptnavigation"><Link href="/#produkte">Streusalz</Link><Link href="/#gemeinschaft">Gemeinsam bestellen</Link><Link href="/#wissen">Wissen & Service</Link></nav>
          <PriceCalculatorLink />
          <MobileMenu />
        </div></header>
        {!isLiveReady() && <div className="preview-banner">{isSiteIndexable() ? "Online-Bestellungen sind derzeit nicht freigeschaltet. Beratung und Anfragen per E-Mail." : "Vorschau · Online-Bestellungen sind noch nicht freigeschaltet. Beratung per E-Mail."}</div>}
        {children}
        <footer className="site-footer"><div className="container footer-grid"><div><Link href="/" className="brand" aria-label="Streusalz Großhandel Startseite"><Image className="brand-icon" src="/images/streusalz-logo.png" alt="" width={80} height={41} unoptimized /><span className="brand-copy"><span className="brand-domain">STREUSALZ-<wbr />GROSSHANDEL.DE</span></span></Link><p>Ihr Partner für Streusalz und Auftausalz.<br />Große Mengen. Klare Konditionen.</p></div><div><h3>Direkter Kontakt</h3><a href={`mailto:${company.email}`}>{company.email}</a><p>{company.name} · {company.city}</p></div><div><h3>Gut zu wissen</h3><Link href="/bestellen">Bestellung & Preise</Link><Link href="/#faq">Häufige Fragen</Link><Link href="/admin">Bestellverwaltung</Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Streusalz Großhandel · Nur für Gewerbetreibende und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden.</span><div><Link href="/impressum">Impressum</Link><Link href="/datenschutz">Datenschutz</Link><Link href="/agb">AGB</Link></div></div></footer>
      </body>
    </html>
  );
}

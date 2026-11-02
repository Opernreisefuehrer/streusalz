import type { Metadata } from "next";
import Link from "next/link";
import { Checkout } from "@/components/checkout";
import { isLiveReady, isSiteIndexable } from "@/lib/config";
import { legalTexts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Bestellen & Preis inkl. Lieferung",
  alternates: { canonical: "/bestellen" },
  robots: { index: isSiteIndexable() && isLiveReady(), follow: isSiteIndexable() },
};
export default async function OrderPage({ searchParams }: { searchParams: Promise<{ produkt?: string; gemeinschaft?: string }> }) {
  const params = await searchParams;
  return <main id="main"><div className="page-intro"><div className="container"><div className="breadcrumbs"><Link href="/">Startseite</Link> / Bestellung</div><p className="eyebrow">KLAR KALKULIERT. AUF RECHNUNG.</p><h1>Ihr Wintervorrat.<br />Ihre Konditionen.</h1><p>{params.gemeinschaft === "1" ? "Planen Sie Ihre gemeinsame Lieferung mit bis zu drei Unternehmen und separaten Rechnungen." : "Bestellen Sie für Ihr Unternehmen: ein Rechnungsempfänger, eine Lieferadresse."} Prüfen Sie sämtliche Kosten vor dem Abschluss.</p></div></div><Checkout initialProduct={params.produkt === "bags" ? "bags" : "bigbag"} community={params.gemeinschaft === "1"} enabled={isLiveReady()} legalVersion={legalTexts().version} /></main>;
}

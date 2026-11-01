import type { Metadata } from "next";
import Link from "next/link";
import { Checkout } from "@/components/checkout";
import { isLiveReady } from "@/lib/config";
import { legalTexts } from "@/lib/legal";

export const metadata: Metadata = { title: "Bestellen & Lieferkosten berechnen", alternates: { canonical: "/bestellen" } };
export default async function OrderPage({ searchParams }: { searchParams: Promise<{ produkt?: string; gemeinschaft?: string }> }) {
  const params = await searchParams;
  return <main id="main"><div className="page-intro"><div className="container"><div className="breadcrumbs"><Link href="/">Startseite</Link> / Bestellung</div><p className="eyebrow">KLAR KALKULIERT. AUF RECHNUNG.</p><h1>Ihr Wintervorrat.<br />Ihre Konditionen.</h1><p>Ein Unternehmen oder eine Bestellgemeinschaft: Planen Sie Ihre Lieferung und prüfen Sie sämtliche Kosten vor dem Abschluss.</p></div></div><Checkout initialProduct={params.produkt === "bags" ? "bags" : "bigbag"} community={params.gemeinschaft === "1"} enabled={isLiveReady()} legalVersion={legalTexts().version} /></main>;
}

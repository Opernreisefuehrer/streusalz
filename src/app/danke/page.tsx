import type { Metadata } from "next";
import { Receipt } from "@/components/receipt";
export const metadata: Metadata = { title: "Bestellbestätigung", robots: { index: false, follow: false } };
export default function ThankYou() { return <main id="main"><Receipt /></main>; }

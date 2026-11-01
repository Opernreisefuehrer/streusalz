import type { Metadata } from "next";
export const metadata: Metadata = { title: "Bestellverwaltung", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <main id="main">{children}</main>; }

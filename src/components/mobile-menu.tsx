"use client";
import { useState } from "react";
import Link from "next/link";
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return <div className="mobile-menu" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Menü schließen" : "Menü öffnen"} onClick={() => setOpen(!open)}>{open ? "×" : "☰"}</button>
    {open && <nav id="mobile-navigation" aria-label="Mobile Hauptnavigation">
      <Link href="/#produkte" onClick={() => setOpen(false)}>Streusalz & Gebinde</Link>
      <Link href="/#gemeinschaft" onClick={() => setOpen(false)}>Gemeinsam bestellen</Link>
      <Link href="/#wissen" onClick={() => setOpen(false)}>Wissen & Service</Link>
      <Link href="/#faq" onClick={() => setOpen(false)}>Häufige Fragen</Link>
      <Link href="/bestellen" onClick={() => setOpen(false)}>Bestellung planen ↗</Link>
    </nav>}
  </div>;
}

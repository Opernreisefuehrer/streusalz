"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PriceCalculatorLink() {
  const pathname = usePathname();
  return <Link className="button button-small" href="/bestellen#liefer-plz" onNavigate={event => {
    if (pathname === "/bestellen") {
      const postcode = document.getElementById("liefer-plz");
      if (postcode) {
        event.preventDefault();
        postcode.focus({ preventScroll: true });
        postcode.scrollIntoView({ block: "start" });
      }
    }
  }}>Preis berechnen <span aria-hidden="true">↗</span></Link>;
}

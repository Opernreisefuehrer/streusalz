"use client";
import { useEffect } from "react";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Page rendering failed", error); }, [error]);
  return <main id="main" className="container not-found"><h1>Diese Seite ist gerade nicht verfügbar.</h1><p>Bitte versuchen Sie es erneut. Falls das Problem bleibt, kontaktieren Sie info@streusalz-grosshandel.de.</p><button className="button" onClick={reset}>Erneut versuchen</button></main>;
}

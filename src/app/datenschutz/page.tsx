import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { privacyDocument } from "@/lib/legal";

export const metadata: Metadata = { title: "Datenschutz", alternates: { canonical: "/datenschutz" } };
export default function Privacy() {
  return <LegalDocument document={privacyDocument()} privacy />;
}

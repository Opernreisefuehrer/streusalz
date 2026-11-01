import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { termsDocument } from "@/lib/legal";

export const metadata: Metadata = { title: "AGB", alternates: { canonical: "/agb" } };
export default function Terms() {
  return <LegalDocument document={termsDocument()} />;
}

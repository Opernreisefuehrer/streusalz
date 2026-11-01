import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { termsDocument, privacyDocument, documentText, legalTexts } from "../src/lib/legal";
import { isLiveReady, legalConfigurationComplete, seller } from "../src/lib/config";
import Imprint from "../src/app/impressum/page";
import { PackageArt } from "../src/components/package-art";

afterEach(() => vi.unstubAllEnvs());
describe("consistent legal content and accurate technical notices", () => {
  it("provides complete B2B terms matching acceptance, separate obligations and payment after delivery", () => {
    const document = termsDocument();
    const text = documentText(document);
    expect(document.sections).toHaveLength(14);
    expect(text).toContain("40 Säcke à 25 kg");
    expect(text).toContain("nur seinen eigenen Teilbetrag");
    expect(text).toContain("14 Kalendertage nach der tatsächlichen Lieferung");
    expect(text).toContain("Kunde organisiert die geeignete und sichere Entladung");
    expect(text).toContain("Eingang der Bestellung");
    expect(text).toContain("ausdrückliche Auftragsannahme");
    expect(text).not.toContain("Dej");
  });
  it("uses the privacy mailbox without falsely claiming no end-device storage", () => {
    const document = privacyDocument();
    const text = documentText(document);
    expect(document.sections).toHaveLength(12);
    expect(text).toContain("datenschutz@streusalz-grosshandel.de");
    expect(text).toContain("streusalz-admin");
    expect(text).toContain("streusalz-pending-request");
    expect(text).toContain("streusalz-receipt");
    expect(text).toContain("§ 25 Abs. 2 Nr. 2 TDDDG");
    expect(text).toContain("kein Cookie-Einwilligungsbanner");
    expect(text).not.toContain("Wir verwenden keine Cookies");
    expect(text).toContain("Art. 14 DSGVO");
    expect(text).toContain("acht Jahre");
    expect(text).toContain("keine Öffnungs- oder Marketing-Trackingpixel");
  });
  it("keeps source text, optional overrides and content hashes synchronized", () => {
    const before = legalTexts();
    expect(before.terms).toBe(documentText(termsDocument()));
    expect(before.privacy).toBe(documentText(privacyDocument()));
    expect(before.version).toMatch(/^[a-f0-9]{64}$/);
    vi.stubEnv("TERMS_TEXT", "Reviewed custom terms for testing");
    vi.stubEnv("PRIVACY_TEXT", "Reviewed custom privacy text for testing");
    const after = legalTexts();
    expect(after.terms).toContain("Reviewed custom terms for testing");
    expect(after.privacy).toContain("Reviewed custom privacy text for testing");
    expect(after.version).not.toBe(before.version);
  });
  it("does not publish an invoice-only tax number in the imprint", () => {
    vi.stubEnv("SELLER_TAX_ID", "PRIVATE-TAX-NUMBER-TEST");
    vi.stubEnv("SELLER_VAT_ID", "");
    vi.stubEnv("SELLER_WID", "");
    expect(seller().taxId).toBe("PRIVATE-TAX-NUMBER-TEST");
    expect(renderToStaticMarkup(Imprint())).not.toContain("PRIVATE-TAX-NUMBER-TEST");
    vi.stubEnv("SELLER_VAT_ID", "DE123456789");
    vi.stubEnv("SELLER_WID", "DE987654321-00001");
    const html = renderToStaticMarkup(Imprint());
    expect(html).toContain("DE123456789");
    expect(html).toContain("DE987654321-00001");
    expect(html).not.toContain("PRIVATE-TAX-NUMBER-TEST");
  });
  it("keeps checkout locked until real provider and transfer details are recorded", () => {
    for (const field of ["PRIVACY_DATABASE_PROVIDER", "PRIVACY_DATABASE_COUNTRY", "PRIVACY_MAIL_PROVIDER", "PRIVACY_MAIL_COUNTRY", "PRIVACY_HOSTING_LOG_RETENTION_DAYS", "PRIVACY_TRANSFER_DETAILS"]) vi.stubEnv(field, "");
    vi.stubEnv("SHOP_ENABLED", "true"); vi.stubEnv("LEGAL_READY", "true");
    vi.stubEnv("SELLER_TAX_ID", "TEST-INVOICE-TAX-ID"); vi.stubEnv("SELLER_IBAN", "TEST-IBAN");
    vi.stubEnv("DATABASE_URL", "postgresql://example.invalid/test"); vi.stubEnv("ORS_API_KEY", "test-key");
    vi.stubEnv("SMTP_HOST", "smtp.example.invalid"); vi.stubEnv("SMTP_USER", "test"); vi.stubEnv("SMTP_PASSWORD", "test");
    vi.stubEnv("ADMIN_PASSWORD_HASH", `${"1".repeat(32)}:${"2".repeat(128)}`);
    vi.stubEnv("SESSION_SECRET", "test-only-signing-secret-longer-than-32-characters");
    vi.stubEnv("MAIL_MODE", "smtp"); vi.stubEnv("SITE_URL", "https://shop.example.invalid");
    expect(legalConfigurationComplete()).toBe(false);
    expect(isLiveReady()).toBe(false);
    vi.stubEnv("PRIVACY_DATABASE_PROVIDER", "Test database provider");
    vi.stubEnv("PRIVACY_DATABASE_COUNTRY", "Germany");
    vi.stubEnv("PRIVACY_MAIL_PROVIDER", "Test mail provider");
    vi.stubEnv("PRIVACY_MAIL_COUNTRY", "Germany");
    vi.stubEnv("PRIVACY_HOSTING_LOG_RETENTION_DAYS", "7");
    vi.stubEnv("PRIVACY_TRANSFER_DETAILS", "Test-only recorded review of transfer arrangements");
    expect(legalConfigurationComplete()).toBe(true);
    expect(isLiveReady()).toBe(true);
    vi.stubEnv("PRIVACY_HOSTING_LOG_RETENTION_DAYS", "unknown");
    expect(isLiveReady()).toBe(false);
  });
  it("shows labelled technical drawings with staggered sack fronts and truthful weights", () => {
    const html = renderToStaticMarkup(PackageArt({ kind: "bags" }));
    expect(html.match(/data-layer="/g)).toHaveLength(8);
    expect(html.match(/data-visible-sack="true"/g)).toHaveLength(20);
    expect(html).toContain("40 × 25 kg = 1.000 kg je Palette");
    expect(html).toContain("hintere Säcke sind verdeckt");
    const bigbag = renderToStaticMarkup(PackageArt({ kind: "bigbag" }));
    expect(bigbag).toContain("BigBag mit 1.000 kg Füllgewicht");
    expect(bigbag).toContain("1 BigBag = 1 Tonne");
    for (const schema of [html, bigbag]) {
      expect(schema).not.toContain("linearGradient");
      expect(schema).not.toContain("filter");
      expect(schema).toContain("drawing-grid-");
    }
  });
});

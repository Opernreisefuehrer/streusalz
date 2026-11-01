import "server-only";
import { AppError } from "./errors";

export function siteUrl() {
  return process.env.SITE_URL || "https://www.streusalz-grosshandel.de";
}
export function seller() {
  return {
    name: process.env.SELLER_NAME || "Albino Cipolla",
    street: process.env.SELLER_STREET || "Nahestr. 5",
    postcode: process.env.SELLER_POSTCODE || "55118",
    city: process.env.SELLER_CITY || "Mainz",
    phone: process.env.SELLER_PHONE || "01523-6183155",
    email: process.env.SELLER_EMAIL || "info@streusalz-grosshandel.de",
    taxId: process.env.SELLER_TAX_ID || "",
    bankName: process.env.SELLER_BANK_NAME || "",
    iban: process.env.SELLER_IBAN || "",
    bic: process.env.SELLER_BIC || "",
  };
}
export function isLiveReady() {
  return process.env.SHOP_ENABLED === "true" && process.env.LEGAL_READY === "true"
    && !!process.env.TERMS_TEXT && !!process.env.PRIVACY_TEXT
    && !!process.env.SELLER_TAX_ID && !!process.env.SELLER_IBAN
    && !!process.env.DATABASE_URL && !!process.env.ORS_API_KEY
    && !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD
    && !!process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET?.length ?? 0) >= 32
    && process.env.MAIL_MODE !== "preview"
    && siteUrl().startsWith("https://");
}
export function requireCheckout() {
  if (!isLiveReady()) throw new AppError("Der Online-Bestellabschluss ist noch nicht freigeschaltet. Bitte kontaktieren Sie uns telefonisch oder per E-Mail.", 503);
}
export function signingSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError("Die sichere Shop-Konfiguration ist noch nicht vollständig.", 503);
  return value;
}

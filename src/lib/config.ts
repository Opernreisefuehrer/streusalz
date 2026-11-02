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
    email: process.env.SELLER_EMAIL || "info@streusalz-grosshandel.de",
    vatId: process.env.SELLER_VAT_ID || "",
    economicId: process.env.SELLER_WID || "",
    taxId: process.env.SELLER_VAT_ID || process.env.SELLER_TAX_ID || "",
    bankName: process.env.SELLER_BANK_NAME || "",
    iban: process.env.SELLER_IBAN || "",
    bic: process.env.SELLER_BIC || "",
  };
}
export function privacySettings() {
  const retention = process.env.PRIVACY_HOSTING_LOG_RETENTION_DAYS || "";
  return {
    contactEmail: process.env.PRIVACY_CONTACT_EMAIL || "datenschutz@streusalz-grosshandel.de",
    databaseProvider: process.env.PRIVACY_DATABASE_PROVIDER || "",
    databaseCountry: process.env.PRIVACY_DATABASE_COUNTRY || "",
    mailProvider: process.env.PRIVACY_MAIL_PROVIDER || "",
    mailCountry: process.env.PRIVACY_MAIL_COUNTRY || "",
    hostingLogDays: /^\d+$/.test(retention) && Number.isSafeInteger(Number(retention)) && Number(retention) > 0 ? Number(retention) : null,
    transferDetails: process.env.PRIVACY_TRANSFER_DETAILS || "",
  };
}
export function legalConfigurationComplete() {
  const privacy = privacySettings();
  return !!privacy.databaseProvider && !!privacy.databaseCountry && !!privacy.mailProvider
    && !!privacy.mailCountry && privacy.hostingLogDays !== null && !!privacy.transferDetails
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacy.contactEmail);
}
export function isLiveReady() {
  return process.env.SHOP_ENABLED === "true" && process.env.LEGAL_READY === "true"
    && legalConfigurationComplete()
    && !!seller().taxId && !!process.env.SELLER_IBAN
    && !!process.env.DATABASE_URL && !!process.env.ORS_API_KEY
    && !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD
    && !!process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET?.length ?? 0) >= 32
    && process.env.MAIL_MODE !== "preview"
    && siteUrl().startsWith("https://");
}
export function isSiteIndexable() {
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production"
    || !/^https:\/\/www\.streusalz-grosshandel\.de\/?$/.test(siteUrl())) return false;
  const setting = process.env.SITE_INDEXING_ENABLED;
  return setting === undefined ? isLiveReady() : setting === "true";
}
export function requireCheckout() {
  if (!isLiveReady()) throw new AppError("Der Online-Bestellabschluss ist noch nicht freigeschaltet. Bitte kontaktieren Sie uns per E-Mail.", 503);
}
export function signingSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError("Die sichere Shop-Konfiguration ist noch nicht vollständig.", 503);
  return value;
}

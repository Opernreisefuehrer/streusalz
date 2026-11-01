import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLiveReady, isSiteIndexable, requireCheckout } from "../src/lib/config";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", "https://www.streusalz-grosshandel.de");
  vi.stubEnv("SITE_INDEXING_ENABLED", "true");
  vi.stubEnv("SHOP_ENABLED", "false");
  vi.stubEnv("LEGAL_READY", "false");
});
afterEach(() => vi.unstubAllEnvs());

describe("production indexing without prematurely enabling orders", () => {
  it("allows the public site while keeping checkout closed and private routes excluded", async () => {
    expect(isSiteIndexable()).toBe(true);
    expect(isLiveReady()).toBe(false);
    expect(requireCheckout).toThrow("noch nicht freigeschaltet");
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/danke"] });
    expect(sitemap().map(entry => entry.url)).not.toContain("https://www.streusalz-grosshandel.de/bestellen");
    const { metadata } = await import("../src/app/bestellen/page");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
  it.each(["preview", "development"])("blocks Vercel %s even when the indexing flag is enabled", deployment => {
    vi.stubEnv("VERCEL_ENV", deployment);
    expect(isSiteIndexable()).toBe(false);
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
  it("blocks local production builds and local development", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(isSiteIndexable()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "development");
    expect(isSiteIndexable()).toBe(false);
  });
  it.each(["http://www.streusalz-grosshandel.de", "https://shop-preview.vercel.app", "https://localhost:3000"])("does not index a noncanonical site URL: %s", url => {
    vi.stubEnv("SITE_URL", url);
    expect(isSiteIndexable()).toBe(false);
  });
  it("honours an explicit block and does not index an unready site when the flag is absent", () => {
    vi.stubEnv("SITE_INDEXING_ENABLED", "false");
    expect(isSiteIndexable()).toBe(false);
    vi.stubEnv("SITE_INDEXING_ENABLED", undefined);
    expect(isSiteIndexable()).toBe(false);
  });
  it("preserves automatic indexing for an already fully configured production shop unless explicitly blocked", () => {
    const settings = {
      SHOP_ENABLED: "true", LEGAL_READY: "true", MAIL_MODE: "smtp",
      PRIVACY_DATABASE_PROVIDER: "Test database", PRIVACY_DATABASE_COUNTRY: "Germany",
      PRIVACY_MAIL_PROVIDER: "Test mail", PRIVACY_MAIL_COUNTRY: "Germany",
      PRIVACY_HOSTING_LOG_RETENTION_DAYS: "7", PRIVACY_TRANSFER_DETAILS: "Test-only reviewed arrangements",
      SELLER_TAX_ID: "test-only-tax-id", SELLER_IBAN: "test-only-iban",
      DATABASE_URL: "postgresql://test:test@localhost/test", ORS_API_KEY: "test-only-key",
      SMTP_HOST: "smtp.example.invalid", SMTP_USER: "test@example.invalid", SMTP_PASSWORD: "test-only-password",
      ADMIN_PASSWORD_HASH: "test-only-hash", SESSION_SECRET: "test-only-secret".repeat(3),
    };
    for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
    vi.stubEnv("SITE_INDEXING_ENABLED", undefined);
    expect(isLiveReady()).toBe(true);
    expect(isSiteIndexable()).toBe(true);
    expect(sitemap().map(entry => entry.url)).toContain("https://www.streusalz-grosshandel.de/bestellen");
    vi.stubEnv("SITE_INDEXING_ENABLED", "false");
    expect(isSiteIndexable()).toBe(false);
  });
});

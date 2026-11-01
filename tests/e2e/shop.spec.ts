import { test, expect } from "@playwright/test";
test("homepage preserves the legacy search title, topic and canonical identity", async ({ page, request }) => {
  await page.goto("/");
  const description = "Streusalz für Wege, Einfahrten und Straßen: BigBags und 25-kg-Säcke ab 23 Tonnen. Bundesweite Lieferung auf Rechnung, nur für Gewerbe.";
  await expect(page).toHaveTitle("Streusalz Großhandel");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Streusalz Großhandel");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description);
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  const canonicalUrl = await canonical.getAttribute("href");
  if (!canonicalUrl) throw new Error("The homepage canonical URL is missing.");
  expect(new URL(canonicalUrl).pathname).toBe("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Streusalz für Wege,\s*Einfahrten und Straßen\./ })).toBeVisible();
  await expect(page.locator(".spec-card")).toContainText("Lieferantenspezifikation");
  await expect(page.locator(".spec-card")).toContainText("mind. 96 % NaCl · 0,1–5 mm");
  await expect(page.locator(".spec-card")).not.toContainText("Historische Spezifikation");
  const response = await request.get("/");
  expect(await response.text()).toContain("<title>Streusalz Großhandel</title>");
  const legacy = await request.get("/index.html", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/");
});
test("wholesale header uses the brand domain without duplicate slogans or overlaps", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".site-header .brand-domain")).toHaveText("STREUSALZ-GROSSHANDEL.DE");
  await expect(page.locator(".site-footer .brand-domain")).toHaveText("STREUSALZ-GROSSHANDEL.DE");
  await expect(page.locator(".site-header .brand-domain")).toHaveCSS("font-style", "normal");
  await expect(page.locator(".site-footer .brand-domain")).toHaveCSS("font-style", "normal");
  await expect(page.locator(".site-header .brand-tagline")).toHaveText("25-kg-Säcke · BigBags");
  await expect(page.locator(".topbar")).toContainText("Direkt vom Großhändler · Bundesweite Lieferung · Faire Preise");
  await expect(page.locator(".hero .eyebrow")).not.toContainText(/direkt vom großhändler/i);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => window.innerWidth)).toBe(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator(".header-inner").evaluate(header => {
      const items = Array.from(header.children).map(child => child.getBoundingClientRect()).filter(bounds => bounds.width > 0);
      return items.every((bounds, index) => index === 0 || bounds.left >= items[index - 1].right);
    })).toBe(true);
    if (width === 320) {
      await page.getByRole("button", { name: "Menü öffnen" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile Hauptnavigation" }).getByRole("link", { name: /Bestellung planen/ })).toHaveAttribute("href", "/bestellen");
      await page.getByRole("button", { name: "Menü schließen" }).click();
    }
  }
});
test("professional storefront, navigation and responsive layout", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Streusalz Großhandel/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Der Winter kommt/);
  await expect(page.locator(".hero-image")).toBeVisible();
  expect(await page.locator(".hero-image").evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Gemeinschaftsbestellung planen" }).click();
  await expect(page.getByRole("heading", { name: "Ihre Bestellgemeinschaft" })).toBeVisible();
  await expect(page.locator(".participant-block")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Zahlungspflichtig bestellen/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("quantity rules, product separation and clear missing routing configuration", async ({ page }) => {
  await page.goto("/bestellen?produkt=bags");
  await expect(page.getByRole("radio", { name: /25-kg-Sackware/ })).toBeChecked();
  await page.getByLabel("Menge in vollen Tonnen").fill("22");
  await expect(page.locator('.message-error[role="alert"]')).toContainText("23, 46, 69");
  await expect(page.getByRole("button", { name: /Lieferkosten verbindlich berechnen/ })).toBeDisabled();
  await page.getByLabel("Menge in vollen Tonnen").fill("23");
  await page.getByRole("button", { name: /Lieferkosten verbindlich berechnen/ }).click();
  await expect(page.locator('.message-error[role="alert"]')).toContainText("ausfüllen");
});
test("admin is protected and preview is not indexable", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("button", { name: /Sicher anmelden/ })).toBeVisible();
  const result = await request.get("/robots.txt");
  expect(await result.text()).toContain("Disallow: /");
  const document = await request.get("/api/admin/documents/00000000-0000-4000-8000-000000000000");
  expect(document.status()).toBe(401);
  await page.goto("/bestellen");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("/bestellen</loc>");
});
test("provided brand logo, favicons and technical package drawings appear consistently", async ({ page, request }) => {
  await page.goto("/");
  const logos = page.locator('img.brand-icon[src="/images/streusalz-logo.png"]');
  await expect(logos).toHaveCount(2);
  await logos.last().scrollIntoViewIfNeeded();
  await expect.poll(() => logos.evaluateAll(images => images.every(image =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth === 704 && image.naturalHeight === 359,
  ))).toBe(true);
  await expect(page.locator('img[src="/snowflake.svg"]')).toHaveCount(0);
  const icon = page.locator('link[rel="icon"][href*="/icon.png"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("sizes", "512x512");
  const iconUrl = await icon.getAttribute("href");
  if (!iconUrl) throw new Error("The generated brand icon is missing its URL.");
  const iconResponse = await request.get(iconUrl);
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()["content-type"]).toContain("image/png");
  await expect(page.locator('link[rel="apple-touch-icon"][href*="/apple-icon.png"]')).toHaveAttribute("sizes", "180x180");
  await expect(page.locator('link[rel="icon"][href*="/icon.svg"]')).toHaveCount(0);
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  const faviconBytes = await favicon.body();
  expect(faviconBytes.readUInt16LE(2)).toBe(1);
  expect(faviconBytes.readUInt16LE(4)).toBe(4);
  expect([0, 1, 2, 3].map(index => faviconBytes[6 + index * 16])).toEqual([16, 32, 48, 64]);
  const bigbag = page.getByRole("img", { name: /Technische Illustration: BigBag mit 1.000 kg/ });
  await expect(bigbag).toBeVisible();
  await expect(bigbag).toContainText("1 BigBag = 1 Tonne");
  const pallet = page.getByRole("img", { name: /Technische Illustration: Palette mit 40 Säcken à 25 kg/ });
  await expect(pallet).toBeVisible();
  await expect(pallet.locator("[data-layer]")).toHaveCount(8);
  await expect(pallet.locator("[data-visible-sack]")).toHaveCount(20);
  for (let layer = 1; layer <= 8; layer++) {
    await expect(pallet.locator(`[data-layer="${layer}"] [data-visible-sack]`)).toHaveCount(layer % 2 === 1 ? 2 : 3);
  }
  await expect(pallet).toContainText("40 × 25 kg = 1.000 kg je Palette");
  await expect(page.locator(".visual-caption")).toHaveText([
    "Technische Illustration · nicht maßstabsgetreu",
    "Technische Illustration · nicht maßstabsgetreu",
  ]);
  expect(await page.locator(".product-visual").evaluateAll(visuals => visuals.every(visual => {
    const drawing = visual.querySelector("svg");
    const caption = visual.querySelector(".visual-caption");
    if (!drawing || !caption) return false;
    const drawingBounds = drawing.getBoundingClientRect();
    const captionBounds = caption.getBoundingClientRect();
    const visualBounds = visual.getBoundingClientRect();
    return captionBounds.top >= drawingBounds.bottom && captionBounds.bottom <= visualBounds.bottom
      && drawingBounds.width <= visualBounds.width;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator(".hero-image")).toHaveAttribute("alt", /volle 1-Tonnen-Palette mit 40 Säcken/);
  await expect(page.locator(".hero-image")).toHaveAttribute("alt", /feinkörnigem Streusalz/);
});
test("legal pages explain necessary storage and show the correct privacy contact", async ({ page }) => {
  await page.goto("/datenschutz");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Datenschutzerklärung");
  await expect(page.getByRole("link", { name: /datenschutz@streusalz-grosshandel.de/ })).toHaveAttribute("href", "mailto:datenschutz@streusalz-grosshandel.de");
  await expect(page.locator(".legal-article")).toContainText("streusalz-admin");
  await expect(page.locator(".legal-article")).toContainText("streusalz-pending-request");
  await expect(page.locator(".legal-article")).toContainText("§ 25 Abs. 2 Nr. 2 TDDDG");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/agb");
  await expect(page.getByRole("heading", { name: "3. Bestellung und Vertragsschluss" })).toBeVisible();
  await expect(page.locator(".legal-article")).toContainText("14 Kalendertage nach der tatsächlichen Lieferung");
  await page.goto("/impressum");
  await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();
  await expect(page.locator("main")).toContainText("nicht im Handelsregister");
});

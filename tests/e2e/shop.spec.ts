import { test, expect } from "@playwright/test";
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
});
test("snowflake and labelled technical package drawings appear consistently", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('img.brand-icon[src="/snowflake.svg"]')).toHaveCount(2);
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

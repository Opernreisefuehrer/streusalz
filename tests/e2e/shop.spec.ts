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

import { test, expect } from "@playwright/test";
import type { Product, LoadItem } from "../../src/lib/catalog";
test("homepage preserves the legacy search title, topic and canonical identity", async ({ page, request }) => {
  await page.goto("/");
  const description = "Streusalz für Wege, Einfahrten und Straßen: BigBags und 25-kg-Säcke ab 23 Tonnen. Bundesweite Lieferung auf Rechnung für Gewerbe, Städte und Gemeinden.";
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
test("single company is the default and community ordering is an optional special case", async ({ page }) => {
  await page.goto("/bestellen");
  await expect(page.getByRole("heading", { name: "Ihr Unternehmen oder Ihre Einrichtung", exact: true })).toBeVisible();
  await expect(page.locator("form .eyebrow").first()).toHaveText("01 · MENGE & PREIS");
  await expect(page.locator("form")).toContainText("Zahlbar ohne Abzug. Kein Skonto.");
  await expect(page.locator(".site-footer")).toContainText("Nur für Gewerbetreibende und öffentliche Auftraggeber, z. B. Städte und Gemeinden. Kein Verkauf an Privatkunden.");
  await expect(page.locator(".participant-block")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Rechnungsempfänger & Lieferung" })).toBeVisible();
  await expect(page.getByLabel("BigBags: Anzahl der 23-t-Ladungen")).toHaveValue("1");
  await expect(page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen")).toHaveValue("0");
  await expect(page.getByLabel("BigBags: Anzahl der 23-t-Ladungen")).toHaveAttribute("step", "1");
  const quantity = page.getByLabel("Menge in Tonnen", { exact: true });
  const postcode = page.getByLabel("Liefer-PLZ", { exact: true });
  await expect(quantity).toHaveValue("23");
  await expect(quantity).toHaveAttribute("readonly", "");
  const quantityBounds = await quantity.boundingBox();
  const postcodeBounds = await postcode.boundingBox();
  expect(quantityBounds).not.toBeNull();
  expect(postcodeBounds).not.toBeNull();
  if (!quantityBounds || !postcodeBounds) throw new Error("Quantity and postcode inputs are missing.");
  if (page.viewportSize()!.width > 760) expect(Math.abs(quantityBounds.y - postcodeBounds.y)).toBeLessThan(2);
  for (const count of await page.locator(".product-option input").all()) {
    const bounds = await count.boundingBox();
    expect(bounds?.width).toBeLessThanOrEqual(90);
    expect(bounds?.height).toBeLessThanOrEqual(40);
  }
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Telefon für die Lieferabstimmung", exact: true })).toBeVisible();
  await expect(page.locator("form")).toContainText("verbindliches Kaufangebot");
  await expect(page.locator("form")).toContainText("kein gesetzliches Widerrufsrecht");
  const business = page.getByRole("checkbox", { name: /Ich bestelle für ein Unternehmen oder einen öffentlichen Auftraggeber/ });
  await expect(business).not.toHaveAccessibleName(/Teilnehmer/);
  await page.getByLabel("Name des Unternehmens / der Einrichtung").fill("Gemeinde Musterhausen");
  await business.check();
  await expect(business).toBeChecked();
  await expect(page.getByLabel("USt-IdNr. (optional)")).not.toHaveAttribute("required");
  await expect(page.getByRole("complementary", { name: "Preisübersicht" })).toContainText("Lieferadresse / Rechnung");
  const add = page.getByRole("button", { name: "+ Weiteren Auftraggeber hinzufügen", exact: true });
  await expect(add).toBeHidden();
  await page.getByText("Sonderfall: Gemeinschaftsbestellung mit weiteren Auftraggebern", { exact: true }).click();
  await add.click();
  await expect(page.getByRole("heading", { name: "Ihre Bestellgemeinschaft" })).toBeVisible();
  await expect(page.locator(".participant-block")).toHaveCount(2);
  await expect(page.getByLabel("Menge in vollen Tonnen").first()).toHaveAttribute("step", "1");
  await expect(page.getByLabel("Menge in vollen Tonnen").first()).toHaveValue("23");
  await expect(page.getByLabel("Menge in vollen Tonnen").nth(1)).toHaveValue("");
  await page.getByLabel("Menge in vollen Tonnen").first().fill("22");
  await page.getByLabel("Menge in vollen Tonnen").nth(1).fill("1");
  await add.click();
  await expect(page.locator(".participant-block")).toHaveCount(3);
  await expect(page.getByLabel("Menge in vollen Tonnen").nth(2)).toHaveValue("");
  await expect(add).toHaveCount(0);
  await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
  await page.getByRole("button", { name: "Entfernen", exact: true }).last().click();
  await expect(page.locator(".participant-block")).toHaveCount(1);
  await expect(page.getByLabel("BigBags: Anzahl der 23-t-Ladungen")).toHaveValue("1");
  await expect(page.getByRole("heading", { name: "Rechnungsempfänger & Lieferung" })).toBeVisible();
  await page.getByText("Sonderfall: Gemeinschaftsbestellung mit weiteren Auftraggebern", { exact: true }).click();
  await add.click();
  const secondCompany = page.locator(".participant-block").nth(1);
  await secondCompany.getByRole("checkbox", { name: "Abweichende Rechnungsanschrift" }).check();
  await expect(secondCompany.getByLabel("Rechnungsanschrift: Straße und Hausnummer")).toBeVisible();
});
test("the header price button scrolls directly to the postcode input, including repeated clicks and community orders", async ({ page }) => {
  const priceLink = page.locator(".site-header").getByRole("link", { name: /Preis berechnen/ });
  const postcode = page.locator("#liefer-plz");
  const expectPostcodeInView = async () => {
    await expect(postcode).toHaveCount(1);
    await expect.poll(() => postcode.evaluate(input => {
      const bounds = input.getBoundingClientRect();
      const header = document.querySelector(".site-header")!.getBoundingClientRect();
      return bounds.top >= header.bottom && bounds.bottom <= window.innerHeight;
    })).toBe(true);
  };
  await page.goto("/");
  await expect(priceLink).toHaveAttribute("href", "/bestellen#liefer-plz");
  await priceLink.click();
  await expect(page).toHaveURL(/\/bestellen#liefer-plz$/);
  await expectPostcodeInView();
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await expect(postcode).not.toBeInViewport();
  await priceLink.click();
  await expectPostcodeInView();
  await expect(postcode).toBeFocused();
  await page.goto("/bestellen?gemeinschaft=1");
  await expect(page.locator(".participant-block")).toHaveCount(3);
  await expect(postcode).toHaveCount(1);
  await priceLink.click();
  await expectPostcodeInView();
  await expect(page).toHaveURL(/\/bestellen\?gemeinschaft=1$/);
  await expect(page.locator(".participant-block")).toHaveCount(3);
});
test("postcode all-in price appears automatically and is preserved during address confirmation", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/postcode-price", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: {
      price: { input: route.request().postDataJSON(), createdOn: "2026-11-02", validUntil: Date.now() + 1800000, netCents: 863500, vatCents: 164065, grossCents: 1027565 },
      token: "test-postcode-price-token",
    } });
  });
  let finalRequest: unknown;
  await page.route("**/api/quote", async route => {
    finalRequest = route.request().postDataJSON();
    await route.fulfill({ json: {
      quote: { netCents: 863500, vatCents: 164065, grossCents: 1027565, lines: [{ tonnes: 23, grossCents: 1027565, resolvedAddress: "Teststraße 1, 55118 Mainz", deliveryDate: "2026-11-09" }] },
      token: "test-final-address-quote-token",
    } });
  });
  await page.goto("/bestellen");
  const postcode = page.getByLabel("Liefer-PLZ", { exact: true });
  const summary = page.getByRole("complementary", { name: "Preisübersicht" });
  const tonnePrice = summary.locator(".summary-row").filter({ hasText: "Pro Tonne netto inkl. Lieferung" });
  await expect(tonnePrice).toContainText("PLZ eingeben");
  await expect(summary).not.toHaveClass(/message-success/);
  await expect(summary.getByText("Pro 25-kg-Sack netto inkl. Lieferung", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Aktuellen Preis anzeigen/ })).toBeDisabled();
  await postcode.fill("55118");
  await expect(page.getByRole("status").filter({ hasText: "Aktueller Preis inkl. Lieferung" })).toContainText("8.635,00");
  await expect(page.getByRole("status").filter({ hasText: "Aktueller Preis inkl. Lieferung" })).toHaveCSS("background-color", "rgb(237, 247, 239)");
  await expect(page.getByRole("status").filter({ hasText: "Aktueller Preis inkl. Lieferung" })).toHaveCSS("color", "rgb(39, 97, 53)");
  await expect(summary).toHaveCSS("background-color", "rgb(237, 247, 239)");
  await expect(summary).toHaveCSS("border-top-color", "rgb(183, 216, 191)");
  await expect(summary.getByRole("heading", { name: "Aktueller Preis inkl. Lieferung" })).toHaveCSS("color", "rgb(31, 81, 48)");
  await expect(tonnePrice.locator("span")).toHaveCSS("color", "rgb(54, 93, 64)");
  await expect(summary.locator(".fine-print")).toHaveCSS("color", "rgb(54, 93, 64)");
  expect(requests).toEqual([{ product: "bigbag", postcode: "55118", tonnes: 23 }]);
  await expect(page.getByLabel("Name des Unternehmens / der Einrichtung")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Zahlungspflichtig bestellen/ })).toBeDisabled();
  await expect(page.locator(".participant-block").getByLabel("Postleitzahl")).toHaveValue("55118");
  await expect(summary).toContainText("8.635,00");
  await expect(tonnePrice).toContainText("375,43");
  await expect(summary).not.toContainText(/Lieferkosten|Fracht|ca\.|ungefähr|Schätzung|Warenwert/);
  await page.getByLabel("Lieferanschrift: Straße und Hausnummer").fill("Teststraße 1");
  await page.getByLabel("Ort", { exact: true }).fill("Mainz");
  await expect(summary).toContainText("8.635,00");
  await page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ }).click();
  await expect(summary).toContainText("Teststraße 1, 55118 Mainz");
  await expect(summary).toHaveCSS("background-color", "rgb(237, 247, 239)");
  await expect(tonnePrice).toContainText("375,43");
  expect(finalRequest).toMatchObject({ postcodePriceToken: "test-postcode-price-token", deliveries: [{ tonnes: 23, address: { street: "Teststraße 1", postcode: "55118", city: "Mainz" } }] });
  await expect(summary).toContainText("8.635,00");
  await expect(summary).not.toContainText(/Lieferkosten|Fracht|ca\.|ungefähr|Schätzung|Warenwert/);
});
test("postcode all-in prices are invalidated and fetched again when quantity, product or postcode changes", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/postcode-price", async route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    const netCents = (input.product === "bigbag" ? 863500 : 886500) * input.tonnes / 23;
    const vatCents = Math.round(netCents * .19);
    await route.fulfill({ json: {
      price: { input, createdOn: "2026-11-02", validUntil: Date.now() + 1800000, netCents, vatCents, grossCents: netCents + vatCents },
      token: "test-postcode-price-token",
    } });
  });
  await page.goto("/bestellen");
  const postcode = page.getByLabel("Liefer-PLZ", { exact: true });
  await postcode.fill("55118");
  const summary = page.getByRole("complementary", { name: "Preisübersicht" });
  const tonnePrice = summary.locator(".summary-row").filter({ hasText: "Pro Tonne netto inkl. Lieferung" });
  await expect(summary).toContainText("8.635,00");
  await expect(tonnePrice).toContainText("375,43");
  await page.getByLabel("BigBags: Anzahl der 23-t-Ladungen").fill("2");
  await expect(summary).toContainText("17.270,00");
  await expect(tonnePrice).toContainText("375,43");
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual({ product: "bigbag", postcode: "55118", tonnes: 46 });
  await page.getByLabel("BigBags: Anzahl der 23-t-Ladungen").fill("0");
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("2");
  await expect(summary).toContainText("17.730,00");
  await expect(tonnePrice).toContainText("385,43");
  await expect(summary.locator(".summary-row").filter({ hasText: "Pro 25-kg-Sack netto inkl. Lieferung" })).toContainText("9,64");
  await postcode.fill("10115");
  await expect.poll(() => requests.length).toBe(4);
  expect(requests[3]).toEqual({ product: "bags", postcode: "10115", tonnes: 46 });
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").clear();
  await expect(tonnePrice).toContainText("PLZ eingeben");
  await expect(summary).not.toHaveClass(/message-success/);
  await page.getByLabel("BigBags: Anzahl der 23-t-Ladungen").fill("1");
  await expect(tonnePrice).toBeVisible();
  await expect(summary.getByText("Pro 25-kg-Sack netto inkl. Lieferung", { exact: true })).toHaveCount(0);
});
test("community overview shows delivery-inclusive tonne and sack prices after address confirmation", async ({ page }) => {
  await page.route("**/api/quote", async route => {
    const { deliveries } = route.request().postDataJSON();
    await route.fulfill({ json: {
      quote: { netCents: 886500, vatCents: 168435, grossCents: 1054935, lines: deliveries.map((delivery: { tonnes: number; address: { street: string } }) => ({
        tonnes: delivery.tonnes, grossCents: Math.round(1054935 * delivery.tonnes / 23),
        resolvedAddress: delivery.address.street, deliveryDate: "2026-11-09",
      })) },
      token: "test-community-quote-token",
    } });
  });
  await page.goto("/bestellen?gemeinschaft=1&produkt=bags");
  const summary = page.getByRole("complementary", { name: "Preisübersicht" });
  const tonnePrice = summary.locator(".summary-row").filter({ hasText: "Pro Tonne netto inkl. Lieferung" });
  const sackPrice = summary.locator(".summary-row").filter({ hasText: "Pro 25-kg-Sack netto inkl. Lieferung" });
  await expect(tonnePrice).toContainText("Adressen prüfen");
  await expect(sackPrice).toContainText("Adressen prüfen");
  let index = 0;
  for (const participant of await page.locator(".participant-block").all()) {
    await expect(participant.getByLabel("Menge in vollen Tonnen")).toHaveValue("");
    await participant.getByLabel("Menge in vollen Tonnen").fill(String([10, 8, 5][index++]));
    await participant.getByLabel("Lieferanschrift: Straße und Hausnummer").fill("Teststraße 1");
    await participant.getByLabel("Postleitzahl").fill("55118");
    await participant.getByLabel("Ort", { exact: true }).fill("Mainz");
  }
  await page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ }).click();
  await expect(tonnePrice).toContainText("385,43");
  await expect(sackPrice).toContainText("9,64");
  await expect(summary).toContainText("8.865,00");
  await expect(summary).toHaveCSS("background-color", "rgb(237, 247, 239)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("one order supports differently loaded trucks, correct product unit prices and a single invoice recipient", async ({ page }) => {
  function amounts(input: { product: Product; tonnes: number; items?: LoadItem[] }) {
    const items = (input.items ?? [{ product: input.product, tonnes: input.tonnes }]).map(item => ({
      ...item, netCents: item.tonnes * (item.product === "bigbag" ? 24500 : 25500) + 300000 * item.tonnes / 23,
    }));
    const netCents = items.reduce((sum, item) => sum + item.netCents, 0), vatCents = Math.round(netCents * .19);
    return { netCents, vatCents, grossCents: netCents + vatCents, ...(input.items ? { items } : {}) };
  }
  const requests: unknown[] = [];
  let finalRequest: unknown;
  await page.route("**/api/postcode-price", async route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    await route.fulfill({ json: { price: { input, createdOn: "2026-11-02", validUntil: Date.now() + 1800000, ...amounts(input) }, token: "test-mixed-postcode-price-token" } });
  });
  await page.route("**/api/quote", async route => {
    const input = route.request().postDataJSON();
    finalRequest = input;
    const totals = amounts({ ...input, tonnes: input.deliveries[0].tonnes });
    await route.fulfill({ json: { quote: { ...totals, lines: [{ tonnes: input.deliveries[0].tonnes, grossCents: totals.grossCents, deliveryDate: "2026-11-09", resolvedAddress: "Teststraße 1, 65719 Hofheim" }] }, token: "test-mixed-final-quote-token" } });
  });
  await page.goto("/bestellen");
  await expect(page.locator(".product-option")).toHaveCount(2);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Mehrere Gebindearten", { exact: true })).toHaveCount(0);
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("1");
  await expect(page.getByLabel("BigBags: Anzahl der 23-t-Ladungen")).toHaveValue("1");
  await expect(page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen")).toHaveValue("1");
  await expect(page.locator("form")).toContainText("Beispiel: 23 t BigBags + 23 t 25-kg-Sackware");
  await expect(page.locator(".participant-block")).toHaveCount(1);
  await page.getByLabel("Liefer-PLZ", { exact: true }).fill("65719");
  const summary = page.getByRole("complementary", { name: "Preisübersicht" });
  await expect(summary).toContainText("17.500,00");
  await expect(summary.locator(".summary-row").filter({ hasText: "23 t BigBags · pro Tonne" })).toContainText("375,43");
  await expect(summary.locator(".summary-row").filter({ hasText: "23 t 25-kg-Sackware · pro Tonne" })).toContainText("385,43");
  await expect(summary.locator(".summary-row").filter({ hasText: "Pro 25-kg-Sack" })).toContainText("9,64");
  expect(requests[0]).toMatchObject({ tonnes: 46, items: [{ product: "bigbag", tonnes: 23 }, { product: "bags", tonnes: 23 }] });
  await page.getByLabel("Lieferanschrift: Straße und Hausnummer").fill("Teststraße 1");
  await page.getByLabel("Ort", { exact: true }).fill("Hofheim");
  await page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ }).click();
  await expect(summary).toContainText("Teststraße 1, 65719 Hofheim");
  expect(finalRequest).toMatchObject({ items: [{ product: "bigbag", tonnes: 23 }, { product: "bags", tonnes: 23 }], deliveries: [{ tonnes: 46 }], postcodePriceToken: "test-mixed-postcode-price-token" });
  await page.getByLabel("BigBags: Anzahl der 23-t-Ladungen").fill("2");
  await expect(summary).toContainText("26.135,00");
  await expect(page.getByLabel("Menge in Tonnen", { exact: true })).toHaveValue("69");
  expect(requests.at(-1)).toMatchObject({ tonnes: 69, items: [{ product: "bigbag", tonnes: 46 }, { product: "bags", tonnes: 23 }] });
  await page.getByLabel("BigBags: Anzahl der 23-t-Ladungen").fill("1");
  await expect(summary).toContainText("17.500,00");
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("2");
  await expect(summary).toContainText("26.365,00");
  await expect(summary).not.toContainText("Teststraße 1, 65719 Hofheim");
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("1.5");
  await expect(page.locator('.message-error[role="alert"]')).toContainText("Je Gebindeart sind volle 23-Tonnen-Ladungen erforderlich");
  await expect(summary).not.toHaveClass(/price-success/);
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("-1");
  await expect(summary).not.toHaveClass(/price-success/);
  await expect(page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ })).toBeDisabled();
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("1");
  await expect(summary).toContainText("17.500,00");
  await page.getByText("Sonderfall: Gemeinschaftsbestellung mit weiteren Auftraggebern", { exact: true }).click();
  await expect(page.getByRole("button", { name: "+ Weiteren Auftraggeber hinzufügen", exact: true })).toBeDisabled();
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("0");
  await expect(summary).toContainText("8.635,00");
  await expect(summary.getByText("Pro 25-kg-Sack netto inkl. Lieferung", { exact: true })).toHaveCount(0);
  expect(requests.at(-1)).not.toHaveProperty("items");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("postcode price errors are visible next to the postcode form", async ({ page }) => {
  await page.route("**/api/postcode-price", route => route.fulfill({
    status: 503, json: { error: "Der Preisservice ist derzeit nicht erreichbar." },
  }));
  await page.goto("/bestellen");
  await page.getByLabel("Liefer-PLZ", { exact: true }).fill("55118");
  await expect(page.locator('.message-error[role="alert"]')).toContainText("Preisservice ist derzeit nicht erreichbar");
  await expect(page.locator('.message-error[role="alert"]')).toHaveCSS("background-color", "rgb(255, 240, 237)");
  await expect(page.getByRole("complementary", { name: "Preisübersicht" })).not.toHaveClass(/message-success/);
  await expect(page.getByRole("button", { name: /Zahlungspflichtig bestellen/ })).toBeDisabled();
});
test("quantity rules, product separation and clear missing routing configuration", async ({ page }) => {
  await page.goto("/bestellen?produkt=bags");
  await expect(page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen")).toHaveValue("1");
  await expect(page.getByLabel("BigBags: Anzahl der 23-t-Ladungen")).toHaveValue("0");
  const summary = page.getByRole("complementary", { name: "Preisübersicht" });
  await expect(summary.locator(".summary-row").filter({ hasText: "Pro Tonne netto inkl. Lieferung" })).toContainText("PLZ eingeben");
  await expect(summary.locator(".summary-row").filter({ hasText: "Pro 25-kg-Sack netto inkl. Lieferung" })).toContainText("PLZ eingeben");
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("0.5");
  await expect(page.locator('.message-error[role="alert"]')).toContainText("23, 46, 69");
  await expect(page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ })).toBeDisabled();
  await page.getByLabel("25-kg-Sackware: Anzahl der 23-t-Ladungen").fill("1");
  await page.getByRole("button", { name: /Lieferadresse prüfen & Gesamtpreis bestätigen/ }).click();
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
  const iconPixels = await page.evaluate(async urls => Promise.all(urls.map(async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot inspect the favicon pixels.");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let gold = 0, navy = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 20) continue;
      if (pixels[i] > pixels[i + 1] && pixels[i + 1] > pixels[i + 2]) gold++;
      if (pixels[i + 2] > pixels[i] + 20) navy++;
    }
    return { gold, navy };
  })), [iconUrl, "/apple-icon.png"]);
  expect(iconPixels.every(icon => icon.gold > 100 && icon.navy === 0)).toBe(true);
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
for (const path of ["/", "/impressum", "/agb", "/datenschutz"]) {
  test(`public seller contact is email-only on ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("01523-6183155");
    await expect(page.locator('a[href="mailto:info@streusalz-grosshandel.de"]').first()).toBeVisible();
    if (path === "/") {
      expect(await page.locator('script[type="application/ld+json"]').allTextContents()).not.toContainEqual(expect.stringContaining('"telephone"'));
    }
  });
}
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

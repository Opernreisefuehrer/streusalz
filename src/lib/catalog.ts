export const PRODUCTS = {
  bigbag: { name: "Streusalz im BigBag", shortName: "BigBags", priceCents: 24500, unit: "1 BigBag = 1 Tonne" },
  bags: { name: "Streusalz in 25-kg-Säcken", shortName: "25-kg-Sackware", priceCents: 25500, unit: "40 Säcke = 1 Palette = 1 Tonne" },
} as const;

export type Product = keyof typeof PRODUCTS;
export const TRUCK_TONNES = 23;
export const VAT_PERCENT = 19;
export function money(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}
export function displayDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

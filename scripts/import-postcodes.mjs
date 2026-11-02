import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node scripts\\import-postcodes.mjs <GeoNames DE.txt>");

const postcodes = new Map();
for (const line of readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
  if (!line) continue;
  const fields = line.split("\t");
  if (fields.length !== 12 || fields[0] !== "DE" || !/^\d{5}$/.test(fields[1])) {
    throw new Error("Invalid German postal-code row.");
  }
  const latitude = Number(fields[9]);
  const longitude = Number(fields[10]);
  const accuracy = Number(fields[11]);
  if (!fields[9] || !fields[10] || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 47 || latitude > 56 || longitude < 5 || longitude > 16 || !Number.isFinite(accuracy)) {
    throw new Error(`Invalid coordinates for postcode ${fields[1]}.`);
  }
  const previous = postcodes.get(fields[1]);
  if (!previous || accuracy > previous.accuracy) {
    postcodes.set(fields[1], { accuracy, coordinates: [longitude, latitude] });
  }
}
if (postcodes.size < 8000 || !postcodes.has("65719")) throw new Error("The German postal-code source is incomplete.");

const destination = fileURLToPath(new URL("../src/lib/data/german-postcodes.json", import.meta.url));
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify({
  source: "https://download.geonames.org/export/zip/DE.zip",
  license: "https://creativecommons.org/licenses/by/4.0/",
  attribution: "GeoNames, CC BY 4.0; reduced to one highest-accuracy location per postcode.",
  importedOn: new Date().toISOString().slice(0, 10),
  postcodes: Object.fromEntries([...postcodes].sort(([a], [b]) => a.localeCompare(b)).map(([postcode, entry]) => [postcode, entry.coordinates])),
}, null, 2) + "\n");
console.log(`Imported ${postcodes.size} German postcodes.`);

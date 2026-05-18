/**
 * Recall Forward Geocoding Pass — Phase 5/6
 *
 * For each photo that has a locationName (from gallery title) but no city:
 *   1. Geocode the locationName string via Nominatim
 *   2. If a result is found, write city/region/country back to the photo
 *
 * Rate limited to 1 req/sec per Nominatim ToS.
 * Re-runnable: skips photos where city is already set.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/forward-geocode.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { forwardGeocode } from "../lib/geocode";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Strings that are not place names — months, seasons, holidays, generic words.
// Captured from gallery titles by the sync regex.
const BLOCKLIST = new Set([
  // Month abbreviations
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  // Month full names
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  // Seasons
  "spring", "summer", "fall", "winter",
  // Holidays / events
  "halloween", "haloween", "passover", "easter", "easter egg hunt",
  "rosh hashanna", "rosh hashanah", "friendsgiving", "christmas", "chritmas party",
  "christmas party", "new years", "new year", "thanksgiving",
  // Generic gallery words
  "photos", "photo", "images", "image", "videos", "video",
  "misc", "other", "untitled", "events", "sports games",
  // Fragments / prefixes
  "scanned jan", "day may",
  // Sports
  "kings playoffs", "kings",
  // Ambiguous single words unlikely to geocode usefully
  "guidos",
]);

// Also skip if the entire string is just a month name possibly prefixed with "scanned "
const MONTH_PATTERN = /^(scanned\s+)?(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/i;

function isPlaceName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (BLOCKLIST.has(lower)) return false;
  if (MONTH_PATTERN.test(lower)) return false;
  // Skip very short strings unlikely to be place names
  if (lower.length < 3) return false;
  // Skip pure numbers
  if (/^\d+$/.test(lower)) return false;
  return true;
}

async function main() {
  console.log("Starting forward geocoding pass…");

  const rows = await prisma.$queryRawUnsafe<{ locationName: string; count: bigint }[]>(`
    SELECT "locationName", COUNT(*) as count
    FROM "Photo"
    WHERE "locationName" IS NOT NULL
      AND "locationName" != ''
      AND "city" IS NULL
    GROUP BY "locationName"
    ORDER BY count DESC
  `);

  const all = rows.map((r) => ({ locationName: r.locationName, count: Number(r.count) }));
  const toGeocode = all.filter((r) => isPlaceName(r.locationName));
  const skipped = all.length - toGeocode.length;

  console.log(`Found ${all.length} distinct location names (${skipped} skipped as non-place, ${toGeocode.length} to geocode).`);

  let geocoded = 0;
  let notFound = 0;
  let photosUpdated = 0;

  for (let i = 0; i < toGeocode.length; i++) {
    const { locationName, count } = toGeocode[i];

    console.log(`[${i + 1}/${toGeocode.length}] "${locationName}" (${count} photos)…`);

    const result = await forwardGeocode(locationName);

    if (result.city || result.region || result.country) {
      geocoded++;
      console.log(`  → ${[result.city, result.region, result.country].filter(Boolean).join(", ")}`);

      const updated = await prisma.photo.updateMany({
        where: { locationName, city: null },
        data: {
          city: result.city ?? null,
          region: result.region ?? null,
          country: result.country ?? null,
        },
      });
      photosUpdated += updated.count;
    } else {
      notFound++;
      console.log(`  → no result`);
    }

    await sleep(1100);
  }

  console.log("\n=== Forward geocoding complete ===");
  console.log(`Location names processed : ${toGeocode.length}`);
  console.log(`Successfully geocoded    : ${geocoded}`);
  console.log(`No result               : ${notFound}`);
  console.log(`Photos updated          : ${photosUpdated}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

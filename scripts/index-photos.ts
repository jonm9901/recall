/**
 * Recall Indexing Pipeline — Phase 4
 *
 * For each unindexed photo:
 *   1. Fetch image bytes from SmugMug CDN
 *   2. DetectLabels  → save scene tags to PhotoTag
 *   3. IndexFaces    → index each face; cluster with existing Person records via SearchFaces
 *   4. ReverseGeocode → fill city/region/country if lat/lng present but city missing
 *   5. Mark photo as indexedAt = now()
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/index-photos.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ensureCollection,
  detectLabels,
  indexFaces,
  searchSimilarFaces,
} from "../lib/rekognition";
import { reverseGeocode } from "../lib/geocode";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function indexPhoto(photo: {
  id: string;
  thumbnailUrl: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
}): Promise<{ tags: number; faces: number; geocoded: boolean }> {
  const bytes = await fetchImageBytes(photo.thumbnailUrl);
  if (!bytes) {
    throw new Error(`Failed to fetch image bytes for photo ${photo.id}`);
  }

  // ── Labels ──────────────────────────────────────────────────────────────
  let tagCount = 0;
  try {
    const labels = await detectLabels(bytes);
    if (labels.length > 0) {
      await prisma.photoTag.createMany({
        data: labels.map((l) => ({
          photoId: photo.id,
          tag: l.tag,
          confidence: l.confidence,
          source: "rekognition",
        })),
        skipDuplicates: true,
      });
      tagCount = labels.length;
    }
  } catch {
    // Non-fatal — label detection failure won't block face indexing
  }

  // ── Faces ────────────────────────────────────────────────────────────────
  let faceCount = 0;
  try {
    const faces = await indexFaces(bytes);

    for (const face of faces) {
      // Search for similar faces already in the collection (to cluster)
      const matches = await searchSimilarFaces(face.faceId);

      let personId: string | null = null;

      if (matches.length > 0) {
        // Find the best match that has an existing Person in the DB
        for (const match of matches) {
          const existingPerson = await prisma.person.findUnique({
            where: { rekognitionFaceId: match.faceId },
          });
          if (existingPerson) {
            personId = existingPerson.id;
            break;
          }
        }
      }

      if (!personId) {
        // No matching Person — create a new unnamed one
        const newPerson = await prisma.person.create({
          data: { rekognitionFaceId: face.faceId, name: "" },
        });
        personId = newPerson.id;
      }

      // Link this face to the photo (upsert in case of re-index)
      await prisma.photoPerson.upsert({
        where: { photoId_personId: { photoId: photo.id, personId } },
        update: {
          confidence: face.confidence,
          boundingBoxTop: face.boundingBoxTop,
          boundingBoxLeft: face.boundingBoxLeft,
          boundingBoxWidth: face.boundingBoxWidth,
          boundingBoxHeight: face.boundingBoxHeight,
          clusterGroupId: personId,
        },
        create: {
          photoId: photo.id,
          personId,
          confidence: face.confidence,
          boundingBoxTop: face.boundingBoxTop,
          boundingBoxLeft: face.boundingBoxLeft,
          boundingBoxWidth: face.boundingBoxWidth,
          boundingBoxHeight: face.boundingBoxHeight,
          clusterGroupId: personId,
        },
      });

      faceCount++;
      await sleep(100); // brief pause between SearchFaces calls
    }
  } catch {
    // Non-fatal — face indexing failure won't block geocoding
  }

  // ── Reverse Geocoding ────────────────────────────────────────────────────
  let geocoded = false;
  if (photo.lat && photo.lng && !photo.city) {
    try {
      const loc = await reverseGeocode(photo.lat, photo.lng);
      if (loc.city || loc.region || loc.country) {
        await prisma.photo.update({
          where: { id: photo.id },
          data: {
            city: loc.city,
            region: loc.region,
            country: loc.country,
          },
        });
        geocoded = true;
      }
      await sleep(1100); // Nominatim rate limit: 1 req/sec
    } catch {
      // Non-fatal
    }
  }

  // ── Mark as indexed ──────────────────────────────────────────────────────
  await prisma.photo.update({
    where: { id: photo.id },
    data: { indexedAt: new Date() },
  });

  return { tags: tagCount, faces: faceCount, geocoded };
}

async function main() {
  console.log("\n🔍 Recall Indexing Pipeline\n");
  const start = Date.now();

  await ensureCollection();

  const total = await prisma.photo.count({ where: { indexedAt: null } });
  console.log(`   ${total.toLocaleString()} photos to index\n`);

  if (total === 0) {
    console.log("✅ All photos already indexed.\n");
    return;
  }

  let processed = 0;
  let totalTags = 0;
  let totalFaces = 0;
  let totalGeocoded = 0;
  let errors = 0;

  const BATCH_SIZE = 50;

  while (true) {
    const batch = await prisma.photo.findMany({
      where: { indexedAt: null },
      select: { id: true, thumbnailUrl: true, lat: true, lng: true, city: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    for (const photo of batch) {
      try {
        const result = await indexPhoto(photo);
        totalTags += result.tags;
        totalFaces += result.faces;
        if (result.geocoded) totalGeocoded++;
        processed++;

        if (processed % 100 === 0) {
          const pct = ((processed / total) * 100).toFixed(1);
          const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
          console.log(
            `   [${pct}%] ${processed.toLocaleString()}/${total.toLocaleString()} indexed — ` +
            `${totalFaces} faces, ${totalTags} tags, ${totalGeocoded} geocoded (${elapsed}m elapsed)`
          );
        }
      } catch (err) {
        errors++;
        console.error(`   ⚠ Failed photo ${photo.id}:`, err);
      }

      // Throttle: ~1 photo/sec to respect Rekognition rate limits
      await sleep(500);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Indexing complete:`);
  console.log(`   Photos indexed:   ${processed.toLocaleString()}`);
  console.log(`   Faces found:      ${totalFaces.toLocaleString()}`);
  console.log(`   Tags saved:       ${totalTags.toLocaleString()}`);
  console.log(`   Photos geocoded:  ${totalGeocoded.toLocaleString()}`);
  console.log(`   Errors:           ${errors}`);
  console.log(`   Time:             ${elapsed}s\n`);
}

main()
  .catch((err) => {
    console.error("\n❌ Indexing failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

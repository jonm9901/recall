/**
 * SmugMug sync script — Phase 3
 * Fetches all galleries and photos from SmugMug and upserts them into the DB.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/smugmug-sync.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchAllAlbums,
  fetchAlbumImages,
  fetchImageSizes,
  fetchImageExif,
  parseLocationFromTitle,
} from "../lib/smugmug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSecondaryPasswordProtected(album: {
  SecurityType?: string;
  PasswordHint?: string;
}): boolean {
  // All albums may have SecurityType "Password" from the site-level password.
  // A non-empty PasswordHint signals a *secondary* per-album password beyond the site password.
  return Boolean(album.PasswordHint && album.PasswordHint.trim().length > 0);
}

async function syncGalleries() {
  console.log("📁 Fetching all albums from SmugMug…");
  const albums = await fetchAllAlbums();
  console.log(`   Found ${albums.length} albums`);

  let synced = 0;
  let skipped = 0;
  let photosSynced = 0;
  let photosSkipped = 0;

  for (const album of albums) {
    if (isSecondaryPasswordProtected(album)) {
      console.log(`   ⛔ Skipping (secondary password): ${album.Name}`);
      await prisma.gallery.upsert({
        where: { smugmugId: album.AlbumKey },
        update: { excluded: true, title: album.Name },
        create: {
          smugmugId: album.AlbumKey,
          title: album.Name,
          smugmugUrl: album.WebUri,
          excluded: true,
        },
      });
      skipped++;
      continue;
    }

    const locationName = parseLocationFromTitle(album.Name);

    const gallery = await prisma.gallery.upsert({
      where: { smugmugId: album.AlbumKey },
      update: {
        title: album.Name,
        smugmugUrl: album.WebUri,
        locationName: locationName || undefined,
        excluded: false,
      },
      create: {
        smugmugId: album.AlbumKey,
        title: album.Name,
        smugmugUrl: album.WebUri,
        locationName: locationName || undefined,
        excluded: false,
      },
    });

    console.log(`   ✓ ${album.Name}${locationName ? ` [${locationName}]` : ""}`);
    synced++;

    // Fetch photos for this gallery
    let images;
    try {
      images = await fetchAlbumImages(album);
    } catch (err) {
      console.error(`     ⚠ Failed to fetch images for ${album.Name}:`, err);
      continue;
    }

    let galleryPhotoCount = 0;

    for (const image of images) {
      try {
        // Get full-size and thumbnail URLs
        const { imageUrl, thumbnailUrl } = await fetchImageSizes(image);

        // Get EXIF data (GPS + date)
        const exif = await fetchImageExif(image);

        // Determine takenAt
        const takenAt =
          exif.takenAt ||
          (image.DateTimeOriginal ? new Date(image.DateTimeOriginal) : null) ||
          (image.DateTimeUploaded ? new Date(image.DateTimeUploaded) : null);

        // Location source
        const locationSource =
          exif.lat && exif.lng
            ? "gps_exif"
            : locationName
            ? "gallery_title"
            : "none";

        await prisma.photo.upsert({
          where: { smugmugPhotoId: image.ImageKey },
          update: {
            imageUrl,
            thumbnailUrl,
            takenAt: takenAt ?? undefined,
            lat: exif.lat,
            lng: exif.lng,
            locationName: exif.lat ? undefined : locationName || undefined,
            locationSource,
          },
          create: {
            galleryId: gallery.id,
            smugmugPhotoId: image.ImageKey,
            imageUrl,
            thumbnailUrl,
            takenAt: takenAt ?? undefined,
            lat: exif.lat,
            lng: exif.lng,
            locationName: exif.lat ? undefined : locationName || undefined,
            locationSource,
          },
        });

        galleryPhotoCount++;
        photosSynced++;

        // Throttle a little to respect rate limits
        await sleep(50);
      } catch (err) {
        console.error(`     ⚠ Failed to sync photo ${image.ImageKey}:`, err);
        photosSkipped++;
      }
    }

    console.log(`     → ${galleryPhotoCount} photos`);

    // Brief pause between albums
    await sleep(200);
  }

  return { synced, skipped, photosSynced, photosSkipped };
}

async function main() {
  console.log("\n🔄 Recall SmugMug Sync\n");
  const start = Date.now();

  try {
    const stats = await syncGalleries();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log("\n✅ Sync complete:");
    console.log(`   Galleries synced: ${stats.synced}`);
    console.log(`   Galleries skipped (secondary password): ${stats.skipped}`);
    console.log(`   Photos synced: ${stats.photosSynced}`);
    console.log(`   Photos failed: ${stats.photosSkipped}`);
    console.log(`   Time: ${elapsed}s\n`);
  } catch (err) {
    console.error("\n❌ Sync failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

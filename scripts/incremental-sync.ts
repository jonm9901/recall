/**
 * Incremental SmugMug sync script
 * Only fetches photos for galleries where SmugMug's ImageCount differs from the DB count.
 * For a typical month with a handful of new photos this completes in seconds.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/incremental-sync.ts
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
  return Boolean(album.PasswordHint && album.PasswordHint.trim().length > 0);
}

async function main() {
  console.log("\n🔄 Recall SmugMug Incremental Sync\n");
  const start = Date.now();

  console.log("📁 Fetching all albums from SmugMug…");
  const albums = await fetchAllAlbums();
  console.log(`   Found ${albums.length} albums`);

  // Load DB gallery IDs and photo counts in one pass
  const [galleries, dbCounts] = await Promise.all([
    prisma.gallery.findMany({ select: { id: true, smugmugId: true } }),
    prisma.photo.groupBy({ by: ["galleryId"], _count: { id: true } }),
  ]);

  const galleryIdBySmugmugId = new Map(galleries.map((g) => [g.smugmugId, g.id]));
  const dbCountByGalleryId = new Map(dbCounts.map((c) => [c.galleryId, c._count.id]));

  let galleriesChecked = 0;
  let galleriesUpdated = 0;
  let galleriesSkipped = 0;
  let galleriesExcluded = 0;
  let photosSynced = 0;
  let photosFailed = 0;

  for (const album of albums) {
    galleriesChecked++;

    if (isSecondaryPasswordProtected(album)) {
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
      galleriesExcluded++;
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

    const dbPhotoCount = dbCountByGalleryId.get(gallery.id) ?? 0;
    const smugmugPhotoCount = album.ImageCount ?? 0;

    if (dbPhotoCount === smugmugPhotoCount) {
      galleriesSkipped++;
      continue;
    }

    console.log(
      `   ↻ ${album.Name} (SmugMug: ${smugmugPhotoCount}, DB: ${dbPhotoCount})`
    );
    galleriesUpdated++;

    let images;
    try {
      images = await fetchAlbumImages(album);
    } catch (err) {
      console.error(`     ⚠ Failed to fetch images for ${album.Name}:`, err);
      continue;
    }

    for (const image of images) {
      try {
        const { imageUrl, thumbnailUrl } = await fetchImageSizes(image);
        const exif = await fetchImageExif(image);

        const takenAt =
          exif.takenAt ||
          (image.DateTimeOriginal ? new Date(image.DateTimeOriginal) : null) ||
          (image.DateTimeUploaded ? new Date(image.DateTimeUploaded) : null);

        const locationSource =
          exif.lat && exif.lng ? "gps_exif" : locationName ? "gallery_title" : "none";

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

        photosSynced++;
        await sleep(50);
      } catch (err) {
        console.error(`     ⚠ Failed to sync photo ${image.ImageKey}:`, err);
        photosFailed++;
      }
    }

    console.log(`     → ${images.length} photos processed`);
    await sleep(200);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\n✅ Incremental sync complete:");
  console.log(`   Galleries checked:  ${galleriesChecked}`);
  console.log(`   Galleries updated:  ${galleriesUpdated}`);
  console.log(`   Galleries skipped:  ${galleriesSkipped} (no change)`);
  console.log(`   Galleries excluded: ${galleriesExcluded}`);
  console.log(`   Photos synced:      ${photosSynced}`);
  if (photosFailed > 0) console.log(`   Photos failed:      ${photosFailed}`);
  console.log(`   Time: ${elapsed}s\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n❌ Sync failed:", err);
  process.exit(1);
});

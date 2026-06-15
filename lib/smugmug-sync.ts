import { prisma } from "@/lib/prisma";
import {
  fetchAllAlbums,
  fetchAlbumImages,
  fetchImageSizes,
  fetchImageExif,
  parseLocationFromTitle,
} from "@/lib/smugmug";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSecondaryPasswordProtected(album: {
  SecurityType?: string;
  PasswordHint?: string;
}): boolean {
  return Boolean(album.PasswordHint && album.PasswordHint.trim().length > 0);
}

export interface SyncResult {
  galleriesChecked: number;
  galleriesUpdated: number;
  galleriesSkipped: number;
  galleriesExcluded: number;
  photosSynced: number;
  photosFailed: number;
  elapsedMs: number;
}

export async function runIncrementalSync(): Promise<SyncResult> {
  const start = Date.now();

  const albums = await fetchAllAlbums();

  // Build a map of galleryId → photo count from the DB in one query
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

    // Skip photo fetch if SmugMug count matches DB count
    const dbPhotoCount = dbCountByGalleryId.get(gallery.id) ?? 0;
    const smugmugPhotoCount = album.ImageCount ?? 0;

    if (dbPhotoCount === smugmugPhotoCount) {
      galleriesSkipped++;
      continue;
    }

    galleriesUpdated++;

    let images;
    try {
      images = await fetchAlbumImages(album);
    } catch (err) {
      console.error(`Failed to fetch images for ${album.Name}:`, err);
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
        console.error(`Failed to sync photo ${image.ImageKey}:`, err);
        photosFailed++;
      }
    }

    await sleep(200);
  }

  return {
    galleriesChecked,
    galleriesUpdated,
    galleriesSkipped,
    galleriesExcluded,
    photosSynced,
    photosFailed,
    elapsedMs: Date.now() - start,
  };
}

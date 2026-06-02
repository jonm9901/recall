import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    totalPhotos,
    indexedPhotos,
    gpsPhotos,
    totalGalleries,
    totalPersons,
    namedPersons,
    totalFaceLinks,
    totalTags,
    ratedPhotos,
    topTags,
    photosByYear,
    topLocations,
    topPeople,
    ratingDist,
    topGalleries,
    tagSources,
  ] = await Promise.all([
    prisma.photo.count({ where: { hidden: false } }),
    prisma.photo.count({ where: { hidden: false, indexedAt: { not: null } } }),
    prisma.photo.count({ where: { hidden: false, lat: { not: null } } }),
    prisma.gallery.count({ where: { excluded: false } }),
    prisma.person.count(),
    prisma.person.count({ where: { name: { not: "" } } }),
    prisma.photoPerson.count(),
    prisma.photoTag.count(),
    prisma.photo.count({ where: { avgRating: { not: null } } }),

    // Top 25 tags by frequency (excluding generic ones)
    prisma.$queryRawUnsafe<{ tag: string; count: bigint }[]>(`
      SELECT tag, COUNT(*) as count FROM "PhotoTag"
      WHERE tag NOT IN ('Person','Adult','Clothing','People','Male','Female','Man','Woman',
        'Head','Face','Photography','Portrait','Accessories','Baby','Child','Indoors','Outdoors')
      GROUP BY tag ORDER BY count DESC LIMIT 25
    `),

    // Photos per year
    prisma.$queryRawUnsafe<{ year: number; count: bigint }[]>(`
      SELECT EXTRACT(YEAR FROM "takenAt")::int AS year, COUNT(*)::int AS count
      FROM "Photo" WHERE "takenAt" IS NOT NULL
      GROUP BY year ORDER BY year DESC
    `),

    // Top cities
    prisma.$queryRawUnsafe<{ city: string; country: string | null; count: bigint }[]>(`
      SELECT city, country, COUNT(*) as count FROM "Photo"
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city, country ORDER BY count DESC LIMIT 15
    `),

    // Top named people
    prisma.$queryRawUnsafe<{ name: string; count: bigint }[]>(`
      SELECT p.name, COUNT(pp."photoId")::int as count
      FROM "Person" p JOIN "PhotoPerson" pp ON p.id = pp."personId"
      WHERE p.name != ''
      GROUP BY p.name ORDER BY count DESC LIMIT 15
    `),

    // Rating distribution
    prisma.$queryRawUnsafe<{ stars: number; count: bigint }[]>(`
      SELECT stars, COUNT(*) as count FROM "Rating" GROUP BY stars ORDER BY stars
    `),

    // Top 10 galleries by photo count
    prisma.$queryRawUnsafe<{ title: string; count: bigint }[]>(`
      SELECT g.title, COUNT(p.id) as count
      FROM "Gallery" g JOIN "Photo" p ON g.id = p."galleryId"
      WHERE g.excluded = false
      GROUP BY g.title ORDER BY count DESC LIMIT 10
    `),

    // Tag source breakdown
    prisma.$queryRawUnsafe<{ source: string; count: bigint }[]>(`
      SELECT source, COUNT(*) as count FROM "PhotoTag" GROUP BY source ORDER BY count DESC
    `),
  ]);

  return NextResponse.json({
    overview: {
      totalPhotos,
      indexedPhotos,
      gpsPhotos,
      totalGalleries,
      totalPersons,
      namedPersons,
      totalFaceLinks,
      totalTags,
      ratedPhotos,
    },
    topTags: (topTags as { tag: string; count: bigint }[]).map((r) => ({ tag: r.tag, count: Number(r.count) })),
    photosByYear: (photosByYear as { year: number; count: bigint }[]).map((r) => ({ year: r.year, count: Number(r.count) })),
    topLocations: (topLocations as { city: string; country: string | null; count: bigint }[]).map((r) => ({
      label: [r.city, r.country].filter(Boolean).join(", "),
      count: Number(r.count),
    })),
    topPeople: (topPeople as { name: string; count: bigint }[]).map((r) => ({ name: r.name, count: Number(r.count) })),
    ratingDist: (ratingDist as { stars: number; count: bigint }[]).map((r) => ({ stars: r.stars, count: Number(r.count) })),
    topGalleries: (topGalleries as { title: string; count: bigint }[]).map((r) => ({ title: r.title, count: Number(r.count) })),
    tagSources: (tagSources as { source: string; count: bigint }[]).map((r) => ({ source: r.source, count: Number(r.count) })),
  });
}

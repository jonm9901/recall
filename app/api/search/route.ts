import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
  const tag = searchParams.get("tag") ?? "";
  const minRating = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : null;
  const personIds = searchParams.get("personIds")?.split(",").filter(Boolean) ?? [];
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));

  // Build the where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    hidden: false,
    gallery: { excluded: false },
  };

  // Text search across gallery title, locationName, city, tags, and vision caption
  if (q) {
    where.OR = [
      { gallery: { title: { contains: q, mode: "insensitive" } } },
      { locationName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { region: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { contains: q, mode: "insensitive" } } } },
      { caption: { contains: q, mode: "insensitive" } },
    ];
  }

  // Year filter
  if (year) {
    where.takenAt = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${year + 1}-01-01`),
    };
  }

  // Specific tag filter
  if (tag) {
    where.tags = { some: { tag: { equals: tag, mode: "insensitive" } } };
  }

  // Minimum average rating filter
  if (minRating) {
    where.avgRating = { gte: minRating };
  }

  // People filter — AND logic: photo must include all selected people
  if (personIds.length > 0) {
    where.AND = personIds.map((personId) => ({
      people: { some: { personId } },
    }));
  }

  const [total, photos] = await Promise.all([
    prisma.photo.count({ where }),
    prisma.photo.findMany({
      where,
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        thumbnailUrl: true,
        imageUrl: true,
        takenAt: true,
        lat: true,
        lng: true,
        locationName: true,
        city: true,
        region: true,
        country: true,
        avgRating: true,
        gallery: { select: { id: true, title: true, smugmugUrl: true } },
        tags: {
          select: { tag: true, confidence: true },
          orderBy: { confidence: "desc" },
          take: 10,
        },
        people: {
          select: {
            person: { select: { id: true, name: true } },
            confidence: true,
          },
          where: { person: { name: { not: "" } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    photos,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/faces?filter=unnamed|named|all&page=1&q=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const q = searchParams.get("q") ?? "";
  const PAGE_SIZE = 48;

  const where: Record<string, unknown> = {};
  if (filter === "unnamed") where.name = "";
  if (filter === "named") where.name = { not: "" };
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [total, persons] = await Promise.all([
    prisma.person.count({ where }),
    prisma.person.findMany({
      where,
      orderBy: filter === "named"
        ? [{ photos: { _count: "desc" } }]
        : [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        photos: {
          take: 4,
          orderBy: { photo: { takenAt: "asc" } },
          include: {
            photo: {
              select: { id: true, thumbnailUrl: true, takenAt: true },
            },
          },
        },
        _count: { select: { photos: true } },
      },
    }),
  ]);

  return NextResponse.json({
    persons: persons.map((p) => ({
      id: p.id,
      name: p.name,
      coverPhotoUrl: p.coverPhotoUrl ?? p.photos[0]?.photo.thumbnailUrl ?? null,
      photoCount: p._count.photos,
      samplePhotos: p.photos.map((pp) => ({
        photoId: pp.photoId,
        thumbnailUrl: pp.photo.thumbnailUrl,
      })),
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}

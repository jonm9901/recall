import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/faces?filter=unnamed|named|all&page=1&q=&sort=popular|alpha|recent
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "popular";
  const PAGE_SIZE = Math.min(Number(searchParams.get("pageSize") ?? 48), 2000);

  const where: Record<string, unknown> = {};
  if (filter === "unnamed") where.name = "";
  if (filter === "named") where.name = { not: "" };
  if (q) where.name = { contains: q, mode: "insensitive" };

  // Deferred persons always sort last. Secondary sort depends on requested sort order.
  type OrderBy = Record<string, unknown>;
  const secondarySort: OrderBy =
    sort === "alpha" ? { name: "asc" } :
    sort === "recent" ? { createdAt: "desc" } :
    { photos: { _count: "desc" } }; // popular — most-photographed first for both named and unnamed

  const orderBy = [{ deferred: "asc" }, secondarySort];

  try {
    const [total, persons] = await Promise.all([
      prisma.person.count({ where }),
      prisma.person.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          photos: {
            take: 4,
            where: { photo: { hidden: false } },
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
      persons: persons.map((p: (typeof persons)[number]) => ({
        id: p.id,
        name: p.name,
        deferred: p.deferred,
        coverPhotoUrl: p.coverPhotoUrl ?? p.photos[0]?.photo.thumbnailUrl ?? null,
        photoCount: p._count.photos,
        samplePhotos: p.photos.map((pp: (typeof p.photos)[number]) => ({
          photoId: pp.photoId,
          thumbnailUrl: pp.photo.thumbnailUrl,
          boundingBox: (pp.boundingBoxTop != null && pp.boundingBoxLeft != null && pp.boundingBoxWidth != null && pp.boundingBoxHeight != null)
            ? { top: pp.boundingBoxTop, left: pp.boundingBoxLeft, width: pp.boundingBoxWidth, height: pp.boundingBoxHeight }
            : null,
        })),
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error("[faces] query error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

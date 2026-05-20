import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/hidden-photos — list all hidden photos
// POST /api/admin/hidden-photos — unhide a photo (body: { photoId })
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photos = await prisma.photo.findMany({
    where: { hidden: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      thumbnailUrl: true,
      takenAt: true,
      updatedAt: true,
      gallery: { select: { title: true } },
    },
  });

  return NextResponse.json({ photos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photoId } = await req.json();
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  await prisma.photo.update({ where: { id: photoId }, data: { hidden: false } });
  return NextResponse.json({ ok: true });
}

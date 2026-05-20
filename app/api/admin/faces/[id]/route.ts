import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/faces/[id] — full photo list for a person
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      photos: {
        where: { photo: { hidden: false } },
        orderBy: { photo: { takenAt: "asc" } },
        include: {
          photo: {
            select: {
              id: true,
              thumbnailUrl: true,
              takenAt: true,
              gallery: { select: { title: true } },
            },
          },
        },
      },
      _count: { select: { photos: true } },
    },
  });

  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: person.id,
    name: person.name,
    deferred: person.deferred,
    coverPhotoUrl: person.coverPhotoUrl,
    photoCount: person._count.photos,
    photos: person.photos.map((pp) => ({
      photoId: pp.photoId,
      thumbnailUrl: pp.photo.thumbnailUrl,
      takenAt: pp.photo.takenAt,
      galleryTitle: pp.photo.gallery.title,
      confidence: pp.confidence,
      flagged: pp.flagged,
      boundingBox: (pp.boundingBoxTop != null && pp.boundingBoxLeft != null && pp.boundingBoxWidth != null && pp.boundingBoxHeight != null)
        ? { top: pp.boundingBoxTop, left: pp.boundingBoxLeft, width: pp.boundingBoxWidth, height: pp.boundingBoxHeight }
        : null,
    })),
  });
}

// PATCH /api/admin/faces/[id] — update person (name and/or coverPhotoUrl)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: { name?: string; coverPhotoUrl?: string } = {};

  if (body.name !== undefined) {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  if (body.coverPhotoUrl !== undefined) {
    data.coverPhotoUrl = body.coverPhotoUrl;
  }

  const person = await prisma.person.update({
    where: { id },
    data,
  });

  return NextResponse.json({ id: person.id, name: person.name, coverPhotoUrl: person.coverPhotoUrl });
}

// DELETE /api/admin/faces/[id] — delete person (removes all PhotoPerson links)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.photoPerson.deleteMany({ where: { personId: id } });
  await prisma.person.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

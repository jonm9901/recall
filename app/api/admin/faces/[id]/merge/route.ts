import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/faces/[id]/merge
// body: { intoId } — merges [id] into [intoId], then deletes [id]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: fromId } = await params;
  const { intoId } = await req.json();

  if (!intoId || fromId === intoId) {
    return NextResponse.json({ error: "Valid intoId required" }, { status: 400 });
  }

  // Snapshot the source person before deleting (needed for undo)
  const fromPerson = await prisma.person.findUnique({
    where: { id: fromId },
    select: { name: true, rekognitionFaceId: true, coverPhotoUrl: true, deferred: true },
  });
  if (!fromPerson) return NextResponse.json({ error: "Source person not found" }, { status: 404 });

  // Get all PhotoPerson links on the source person
  const links = await prisma.photoPerson.findMany({ where: { personId: fromId } });

  const movedPhotoIds: string[] = [];

  for (const link of links) {
    // Check if the target person already has a link to this photo
    const exists = await prisma.photoPerson.findUnique({
      where: { photoId_personId: { photoId: link.photoId, personId: intoId } },
    });
    if (exists) {
      // Duplicate — just delete the source link
      await prisma.photoPerson.delete({
        where: { photoId_personId: { photoId: link.photoId, personId: fromId } },
      });
    } else {
      // Re-point to the target person
      await prisma.photoPerson.update({
        where: { photoId_personId: { photoId: link.photoId, personId: fromId } },
        data: { personId: intoId },
      });
      movedPhotoIds.push(link.photoId);
    }
  }

  // Delete the now-empty source person
  await prisma.person.delete({ where: { id: fromId } });

  return NextResponse.json({
    ok: true,
    mergedIntoId: intoId,
    // Undo snapshot — enough to recreate the source person and move photos back
    undo: { fromPerson, movedPhotoIds, intoId },
  });
}

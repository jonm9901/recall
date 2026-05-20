import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/faces/[id]/unmerge
// Reverses a merge: recreates the source person and moves the specified photos back.
// body: { fromPerson: { name, rekognitionFaceId?, coverPhotoUrl?, deferred }, movedPhotoIds: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: currentPersonId } = await params;
  const { fromPerson, movedPhotoIds } = await req.json();

  if (!fromPerson || !Array.isArray(movedPhotoIds)) {
    return NextResponse.json({ error: "fromPerson and movedPhotoIds required" }, { status: 400 });
  }

  // Recreate the original person
  const restored = await prisma.person.create({
    data: {
      name: fromPerson.name ?? "",
      rekognitionFaceId: fromPerson.rekognitionFaceId ?? null,
      coverPhotoUrl: fromPerson.coverPhotoUrl ?? null,
      deferred: fromPerson.deferred ?? false,
    },
  });

  // Move the photos back — skip any that no longer belong to the current person
  for (const photoId of movedPhotoIds) {
    const link = await prisma.photoPerson.findUnique({
      where: { photoId_personId: { photoId, personId: currentPersonId } },
    });
    if (link) {
      await prisma.photoPerson.update({
        where: { photoId_personId: { photoId, personId: currentPersonId } },
        data: { personId: restored.id },
      });
    }
  }

  return NextResponse.json({ ok: true, restoredPersonId: restored.id });
}

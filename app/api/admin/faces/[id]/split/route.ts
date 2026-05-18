import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/faces/[id]/split
// body: { photoId }
// Removes the photo from this person, creates a new unnamed person, re-links the photo to it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: fromPersonId } = await params;
  const { photoId } = await req.json();

  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  // Fetch the existing link so we can preserve confidence + bounding box on the new one
  const existing = await prisma.photoPerson.findUnique({
    where: { photoId_personId: { photoId, personId: fromPersonId } },
  });

  if (!existing) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  // Create a new unnamed person (no rekognitionFaceId — face was already indexed under the original)
  const newPerson = await prisma.person.create({
    data: { name: "" },
  });

  // Re-point the link to the new person
  await prisma.photoPerson.update({
    where: { photoId_personId: { photoId, personId: fromPersonId } },
    data: { personId: newPerson.id },
  });

  return NextResponse.json({ newPersonId: newPerson.id });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findSimilarClusters } from "@/lib/rekognition";

export const dynamic = "force-dynamic";

// POST /api/admin/faces/[id]/similar
// Runs SearchFaces at 75% threshold and returns matching Person clusters,
// excluding the current person and already-named persons (unless they're a match).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: personId } = await params;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { rekognitionFaceId: true },
  });

  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!person.rekognitionFaceId) {
    return NextResponse.json({ error: "No face ID for this person — cannot search" }, { status: 422 });
  }

  // Ask Rekognition for similar faces in the collection
  const matches = await findSimilarClusters(person.rekognitionFaceId);
  if (matches.length === 0) return NextResponse.json({ suggestions: [] });

  // Look up which Person records own these face IDs
  const matchedPersons = await prisma.person.findMany({
    where: {
      rekognitionFaceId: { in: matches.map((m) => m.faceId) },
      id: { not: personId }, // exclude self
    },
    select: {
      id: true,
      name: true,
      coverPhotoUrl: true,
      rekognitionFaceId: true,
      photos: {
        take: 1,
        include: { photo: { select: { thumbnailUrl: true } } },
      },
      _count: { select: { photos: true } },
    },
  });

  // Attach similarity score to each result and sort highest first
  const similarityMap = new Map(matches.map((m) => [m.faceId, m.similarity]));

  const suggestions = matchedPersons
    .map((p: (typeof matchedPersons)[number]) => ({
      id: p.id,
      name: p.name,
      coverPhotoUrl: p.coverPhotoUrl ?? p.photos[0]?.photo.thumbnailUrl ?? null,
      photoCount: p._count.photos,
      similarity: Math.round(similarityMap.get(p.rekognitionFaceId!) ?? 0),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({ suggestions });
}

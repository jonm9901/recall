import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/photos/[id]/rating — current user's rating + photo avg + AI suggestion
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: photoId } = await params;

  const [photo, user] = await Promise.all([
    prisma.photo.findUnique({
      where: { id: photoId },
      select: { avgRating: true, aiSuggestedStars: true, aiSuggestedReason: true },
    }),
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
  ]);

  if (!photo || !user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rating = await prisma.rating.findUnique({
    where: { photoId_userId: { photoId, userId: user.id } },
    select: { stars: true },
  });

  return NextResponse.json({
    userStars: rating?.stars ?? null,
    avgRating: photo.avgRating,
    aiSuggestedStars: photo.aiSuggestedStars,
    aiSuggestedReason: photo.aiSuggestedReason,
  });
}

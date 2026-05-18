import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/photos/[id]/rate — upsert user rating, recalculate avgRating
// body: { stars: 1-5 }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: photoId } = await params;
  const { stars } = await req.json();

  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars must be 1–5" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert rating
  await prisma.rating.upsert({
    where: { photoId_userId: { photoId, userId: user.id } },
    create: { photoId, userId: user.id, stars, ratedAt: new Date() },
    update: { stars, ratedAt: new Date() },
  });

  // Recalculate denormalized avgRating
  const agg = await prisma.rating.aggregate({
    where: { photoId },
    _avg: { stars: true },
  });
  const avgRating = agg._avg.stars;

  await prisma.photo.update({
    where: { id: photoId },
    data: { avgRating },
  });

  return NextResponse.json({ ok: true, avgRating });
}

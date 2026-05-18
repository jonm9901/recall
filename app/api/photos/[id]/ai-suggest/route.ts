import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAiRating } from "@/lib/ai-rating";

export const dynamic = "force-dynamic";

// POST /api/photos/[id]/ai-suggest — generate AI rating suggestion and store on photo
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: photoId } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { thumbnailUrl: true, aiSuggestedStars: true },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Return cached suggestion if already generated
  if (photo.aiSuggestedStars !== null) {
    const p = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { aiSuggestedStars: true, aiSuggestedReason: true },
    });
    return NextResponse.json({ aiSuggestedStars: p!.aiSuggestedStars, aiSuggestedReason: p!.aiSuggestedReason });
  }

  const result = await getAiRating(photo.thumbnailUrl);

  await prisma.photo.update({
    where: { id: photoId },
    data: { aiSuggestedStars: result.stars, aiSuggestedReason: result.reason },
  });

  return NextResponse.json({ aiSuggestedStars: result.stars, aiSuggestedReason: result.reason });
}

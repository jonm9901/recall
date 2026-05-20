import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/photos/[id]/hide — toggle hidden state
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const photo = await prisma.photo.findUnique({ where: { id }, select: { hidden: true } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.photo.update({
    where: { id },
    data: { hidden: !photo.hidden },
    select: { hidden: true },
  });

  return NextResponse.json({ hidden: updated.hidden });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/admin/faces/[id]/flag — toggle flagged on a PhotoPerson link
// body: { photoId, flagged }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: personId } = await params;
  const { photoId, flagged } = await req.json();

  if (!photoId || typeof flagged !== "boolean") {
    return NextResponse.json({ error: "photoId and flagged required" }, { status: 400 });
  }

  await prisma.photoPerson.update({
    where: { photoId_personId: { photoId, personId } },
    data: { flagged },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/faces/next?currentId=xxx
// Returns the next unnamed, non-deferred person ordered by photo count desc.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const currentId = searchParams.get("currentId") ?? "";

  const next = await prisma.person.findFirst({
    where: { name: "", deferred: false, id: { not: currentId } },
    orderBy: [{ photos: { _count: "desc" } }],
    select: { id: true },
  });

  return NextResponse.json({ nextId: next?.id ?? null });
}

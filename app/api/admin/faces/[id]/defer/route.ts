import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/faces/[id]/defer
// Toggles the deferred flag on a Person.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const person = await prisma.person.findUnique({ where: { id }, select: { deferred: true } });
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.person.update({
    where: { id },
    data: { deferred: !person.deferred },
    select: { deferred: true },
  });

  return NextResponse.json({ deferred: updated.deferred });
}

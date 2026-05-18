import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const scriptPath = path.join(process.cwd(), "scripts/index-photos.ts");
  const child = spawn(
    "npx",
    ["ts-node", "--project", "tsconfig.scripts.json", scriptPath],
    {
      detached: true,
      stdio: "ignore",
      env: process.env,
    }
  );
  child.unref();

  return NextResponse.json({ ok: true, message: "Indexing started in background." });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [total, indexed, faceCount, tagCount, geocodedCount] = await Promise.all([
    prisma.photo.count(),
    prisma.photo.count({ where: { indexedAt: { not: null } } }),
    prisma.photoPerson.count(),
    prisma.photoTag.count(),
    prisma.photo.count({ where: { city: { not: null } } }),
  ]);

  const lastIndexed = await prisma.photo.findFirst({
    where: { indexedAt: { not: null } },
    orderBy: { indexedAt: "desc" },
    select: { indexedAt: true },
  });

  return NextResponse.json({
    total,
    indexed,
    unindexed: total - indexed,
    faceCount,
    tagCount,
    geocodedCount,
    lastIndexedAt: lastIndexed?.indexedAt ?? null,
  });
}

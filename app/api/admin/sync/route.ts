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

  // Run smugmug-sync.ts as a child process so it can run to completion
  // without blocking the HTTP response
  const scriptPath = path.join(process.cwd(), "scripts/smugmug-sync.ts");
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

  // Record sync start time
  await prisma.gallery.updateMany({
    where: {},
    data: {}, // no-op just to check DB connectivity
  });

  return NextResponse.json({ ok: true, message: "Sync started in background." });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [galleryCount, photoCount, excludedCount, lastPhoto] = await Promise.all([
    prisma.gallery.count({ where: { excluded: false } }),
    prisma.photo.count(),
    prisma.gallery.count({ where: { excluded: true } }),
    prisma.photo.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return NextResponse.json({
    galleryCount,
    photoCount,
    excludedCount,
    lastSyncAt: lastPhoto?.createdAt ?? null,
  });
}

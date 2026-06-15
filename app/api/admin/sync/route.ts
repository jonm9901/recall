import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runIncrementalSync } from "@/lib/smugmug-sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runIncrementalSync();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
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

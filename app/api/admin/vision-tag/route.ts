import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const scriptPath = path.join(process.cwd(), "scripts/vision-tag-photos.ts");
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

  return NextResponse.json({ ok: true, message: "Vision tagging started in background." });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [total, visionTagged] = await Promise.all([
    prisma.photo.count({ where: { hidden: false } }),
    prisma.photo.count({ where: { hidden: false, visionTaggedAt: { not: null } } }),
  ]);

  const lastTagged = await prisma.photo.findFirst({
    where: { visionTaggedAt: { not: null } },
    orderBy: { visionTaggedAt: "desc" },
    select: { visionTaggedAt: true },
  });

  return NextResponse.json({
    total,
    visionTagged,
    visionUntagged: total - visionTagged,
    lastVisionTaggedAt: lastTagged?.visionTaggedAt ?? null,
  });
}

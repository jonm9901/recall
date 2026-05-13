import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const maxUsers = parseInt(process.env.MAX_USERS || "5", 10);
  const userCount = await prisma.user.count();
  if (userCount >= maxUsers) {
    return NextResponse.json(
      { error: `User limit of ${maxUsers} reached.` },
      { status: 403 }
    );
  }

  const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS || "7", 10);
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.inviteToken.create({
    data: {
      createdById: session.user.id,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const link = `${baseUrl}/invite/${invite.token}`;

  return NextResponse.json({ link, expiresAt });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
  });

  if (!invite || invite.used) {
    return NextResponse.json({ error: "Invalid or already used invite link." }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 400 });
  }

  const maxUsers = parseInt(process.env.MAX_USERS || "5", 10);
  const userCount = await prisma.user.count();
  if (userCount >= maxUsers) {
    return NextResponse.json({ error: "User limit reached." }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        invitedById: invite.createdById,
      },
    }),
    prisma.inviteToken.update({
      where: { token },
      data: { used: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

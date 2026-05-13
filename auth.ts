import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getSmugmugCookieAuthHeader } from "@/lib/smugmug";

function getPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const prisma = getPrisma();
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });
          if (!user) return null;

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!valid) return null;

          return { id: user.id, name: user.name, email: user.email };
        } finally {
          await prisma.$disconnect();
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      // Set SmugMug site-password cookie so CDN images load for this user
      await getSmugmugCookieAuthHeader();
      return session;
    },
  },
});

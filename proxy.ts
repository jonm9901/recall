import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/setup"];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isPublic =
    publicPaths.some((p) => nextUrl.pathname === p) ||
    nextUrl.pathname.startsWith("/invite/") ||
    nextUrl.pathname.startsWith("/api/auth");

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

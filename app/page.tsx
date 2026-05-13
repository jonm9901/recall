import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  // Check if first-time setup is needed (no users exist)
  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">Recall</span>
        <div className="flex items-center gap-4">
          <a href="/settings/users" className="text-sm text-gray-400 hover:text-white transition-colors">
            Settings
          </a>
          <a href="/api/auth/signout" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign out
          </a>
        </div>
      </header>

      {/* Placeholder — Phase 5 will build the search UI here */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-white">Recall</h1>
          <p className="text-gray-400">
            Welcome, {session.user.name}. Search is coming in Phase 5.
          </p>
          <div className="flex gap-4 justify-center mt-6 text-sm">
            <a href="/settings/users" className="text-blue-400 hover:text-blue-300 transition-colors">
              Manage users →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

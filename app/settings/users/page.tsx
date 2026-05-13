import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import InviteSection from "./InviteSection";

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [users, userCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        invitedById: true,
        createdAt: true,
      },
    }),
    prisma.user.count(),
  ]);

  const maxUsers = parseInt(process.env.MAX_USERS || "5", 10);
  const atCap = userCount >= maxUsers;

  // Build a map for invited-by names
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back to search
          </a>
        </div>

        <h1 className="text-2xl font-bold mb-2">Users</h1>
        <p className="text-gray-400 text-sm mb-8">
          {userCount} of {maxUsers} users
        </p>

        {/* User list */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 mb-8">
          {users.map((user) => (
            <div key={user.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {user.id === session.user.id && (
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">you</span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-0.5">{user.email}</div>
                {user.invitedById && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Invited by {userMap[user.invitedById] || "unknown"}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Invite section */}
        <InviteSection atCap={atCap} maxUsers={maxUsers} />
      </div>
    </div>
  );
}

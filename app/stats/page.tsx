import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-gray-400">Loading stats…</div>}>
      <StatsClient />
    </Suspense>
  );
}

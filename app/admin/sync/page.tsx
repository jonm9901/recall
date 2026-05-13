import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SyncClient from "./SyncClient";

export default async function SyncPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [galleryCount, photoCount, excludedCount, lastPhoto] = await Promise.all([
    prisma.gallery.count({ where: { excluded: false } }),
    prisma.photo.count(),
    prisma.gallery.count({ where: { excluded: true } }),
    prisma.photo.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back to search
          </a>
        </div>

        <h1 className="text-2xl font-bold mb-2">SmugMug Sync</h1>
        <p className="text-gray-400 text-sm mb-8">
          Sync galleries and photos from your SmugMug library into the Recall index.
        </p>

        <SyncClient
          initial={{
            galleryCount,
            photoCount,
            excludedCount,
            lastSyncAt: lastPhoto?.createdAt?.toISOString() ?? null,
          }}
        />
      </div>
    </div>
  );
}

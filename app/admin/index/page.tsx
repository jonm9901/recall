import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import IndexClient from "./IndexClient";

export default async function IndexPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [total, indexed, faceCount, tagCount, geocodedCount, lastIndexed] = await Promise.all([
    prisma.photo.count(),
    prisma.photo.count({ where: { indexedAt: { not: null } } }),
    prisma.photoPerson.count(),
    prisma.photoTag.count(),
    prisma.photo.count({ where: { city: { not: null } } }),
    prisma.photo.findFirst({
      where: { indexedAt: { not: null } },
      orderBy: { indexedAt: "desc" },
      select: { indexedAt: true },
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

        <h1 className="text-2xl font-bold mb-2">Photo Indexing</h1>
        <p className="text-gray-400 text-sm mb-8">
          Run AWS Rekognition to detect faces and scene tags, and reverse-geocode GPS coordinates.
        </p>

        <IndexClient
          initial={{
            total,
            indexed,
            unindexed: total - indexed,
            faceCount,
            tagCount,
            geocodedCount,
            lastIndexedAt: lastIndexed?.indexedAt?.toISOString() ?? null,
          }}
        />
      </div>
    </div>
  );
}

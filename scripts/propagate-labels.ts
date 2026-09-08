/**
 * Recall Label Propagation — scripts/propagate-labels.ts
 *
 * For each named person with a rekognitionFaceId, calls SearchFaces to find
 * similar unnamed persons in the Rekognition collection, then optionally merges
 * them — radiating your manual labelling work outward automatically.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/propagate-labels.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/propagate-labels.ts --auto-merge
 *   npx ts-node --project tsconfig.scripts.json scripts/propagate-labels.ts --auto-merge --threshold=90
 *   npx ts-node --project tsconfig.scripts.json scripts/propagate-labels.ts --auto-merge --limit=50
 *
 * Flags:
 *   (none)           Dry run — searches Rekognition, prints candidates, no DB writes
 *   --dry-run        Same as above (explicit)
 *   --auto-merge     Perform merges for all candidates at or above --threshold
 *   --threshold=N    Similarity % required to auto-merge (default: 85, min: 75)
 *   --limit=N        Process only the first N named persons, alphabetically (default: all)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  RekognitionClient,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── CLI flags ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const autoMerge = args.includes("--auto-merge");
  const dryRun = !autoMerge || args.includes("--dry-run");
  const thresholdArg = args.find((a) => a.startsWith("--threshold="));
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const threshold = thresholdArg
    ? Math.min(99, Math.max(75, parseInt(thresholdArg.split("=")[1], 10)))
    : 85;
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
  return { dryRun, threshold, limit };
}

// ── Rekognition ──────────────────────────────────────────────────────────────

interface FaceMatch {
  faceId: string;
  similarity: number;
}

async function searchFaces(
  client: RekognitionClient,
  faceId: string,
  threshold: number
): Promise<FaceMatch[]> {
  try {
    const res = await client.send(
      new SearchFacesCommand({
        CollectionId: process.env.REKOGNITION_COLLECTION_ID!,
        FaceId: faceId,
        FaceMatchThreshold: threshold,
        MaxFaces: 50, // broad net; filtered to unnamed in-process
      })
    );
    return (res.FaceMatches ?? []).map((m) => ({
      faceId: m.Face!.FaceId!,
      similarity: m.Similarity!,
    }));
  } catch {
    return [];
  }
}

// ── Merge ────────────────────────────────────────────────────────────────────

// Move all PhotoPerson links from source → target, then delete source Person.
// Returns the number of photos moved (duplicates are dropped, not double-counted).
async function mergePerson(sourceId: string, targetId: string): Promise<number> {
  const sourceLinks = await prisma.photoPerson.findMany({
    where: { personId: sourceId },
  });

  const targetPhotoIds = new Set(
    (
      await prisma.photoPerson.findMany({
        where: { personId: targetId },
        select: { photoId: true },
      })
    ).map((l) => l.photoId)
  );

  let moved = 0;

  for (const link of sourceLinks) {
    if (targetPhotoIds.has(link.photoId)) {
      // Photo already linked to target — drop the duplicate source link
      await prisma.photoPerson.delete({
        where: {
          photoId_personId: { photoId: link.photoId, personId: sourceId },
        },
      });
    } else {
      // Recreate link under target, preserving all metadata
      await prisma.photoPerson.create({
        data: {
          photoId: link.photoId,
          personId: targetId,
          confidence: link.confidence,
          boundingBoxTop: link.boundingBoxTop,
          boundingBoxLeft: link.boundingBoxLeft,
          boundingBoxWidth: link.boundingBoxWidth,
          boundingBoxHeight: link.boundingBoxHeight,
          clusterGroupId: targetId,
          flagged: link.flagged,
        },
      });
      await prisma.photoPerson.delete({
        where: {
          photoId_personId: { photoId: link.photoId, personId: sourceId },
        },
      });
      moved++;
    }
  }

  await prisma.person.delete({ where: { id: sourceId } });
  return moved;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, threshold, limit } = parseArgs();

  console.log("\n🔗 Recall Label Propagation\n");
  console.log(`   Mode:      ${dryRun ? "DRY RUN (no DB changes)" : "AUTO MERGE"}`);
  console.log(`   Threshold: ${threshold}% similarity`);
  if (limit) console.log(`   Limit:     first ${limit} named persons`);
  console.log();

  const rekognition = new RekognitionClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // All named persons that have a Rekognition face ID to search from
  const namedPersons = await prisma.person.findMany({
    where: {
      name: { not: "" },
      rekognitionFaceId: { not: null },
      deferred: false,
    },
    select: { id: true, name: true, rekognitionFaceId: true },
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  // Build faceId → unnamed Person map; updated as merges happen so one unnamed
  // person can't be claimed by two named persons in the same run
  const unnamedByFaceId = new Map<
    string,
    { id: string; photoCount: number }
  >();
  const unnamedPersons = await prisma.person.findMany({
    where: { name: "" },
    select: {
      id: true,
      rekognitionFaceId: true,
      _count: { select: { photos: true } },
    },
  });
  for (const p of unnamedPersons) {
    if (p.rekognitionFaceId) {
      unnamedByFaceId.set(p.rekognitionFaceId, {
        id: p.id,
        photoCount: p._count.photos,
      });
    }
  }

  console.log(`   Named persons to search:     ${namedPersons.length.toLocaleString()}`);
  console.log(`   Unnamed persons with faceId: ${unnamedByFaceId.size.toLocaleString()}`);
  console.log();

  let searched = 0;
  let totalCandidates = 0;
  let totalMerged = 0;
  let totalPhotosMoved = 0;

  for (const person of namedPersons) {
    const matches = await searchFaces(rekognition, person.rekognitionFaceId!, threshold);

    // Filter to only unnamed persons we haven't already merged this run
    const candidates = matches.flatMap((m) => {
      const u = unnamedByFaceId.get(m.faceId);
      return u ? [{ faceId: m.faceId, similarity: m.similarity, unnamed: u }] : [];
    });

    if (candidates.length > 0) {
      totalCandidates += candidates.length;
      console.log(
        `   ${person.name}  (${candidates.length} candidate${candidates.length !== 1 ? "s" : ""})`
      );

      for (const c of candidates) {
        const pct = c.similarity.toFixed(1);
        const photoLabel = `${c.unnamed.photoCount} photo${c.unnamed.photoCount !== 1 ? "s" : ""}`;

        if (dryRun) {
          console.log(
            `     → ${pct}%  ·  ${photoLabel}  ·  person ${c.unnamed.id}`
          );
        } else {
          const moved = await mergePerson(c.unnamed.id, person.id);
          unnamedByFaceId.delete(c.faceId); // prevent double-merge in same run
          totalMerged++;
          totalPhotosMoved += moved;
          console.log(
            `     ✓  ${pct}%  ·  merged ${moved} photo(s)  ·  person ${c.unnamed.id}`
          );
        }
      }
    }

    searched++;

    // ~4 req/sec — well within Rekognition's default 5 TPS limit
    await sleep(250);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const estimatedCost = (searched * 0.001).toFixed(3);

  console.log(
    `\n${dryRun ? "📋 Dry run complete" : "✅ Propagation complete"}:\n`
  );
  console.log(`   Named persons searched:   ${searched.toLocaleString()}`);
  console.log(`   Unnamed candidates found: ${totalCandidates.toLocaleString()}`);
  if (!dryRun) {
    console.log(`   Persons merged:           ${totalMerged.toLocaleString()}`);
    console.log(`   Photos re-linked:         ${totalPhotosMoved.toLocaleString()}`);
  }
  console.log(`   Rekognition API calls:    ${searched.toLocaleString()}  (~$${estimatedCost})`);

  if (dryRun && totalCandidates > 0) {
    console.log(
      `\n   To apply: re-run with --auto-merge`
    );
  } else if (dryRun && totalCandidates === 0) {
    console.log(`\n   No candidates found at ${threshold}% threshold.`);
    if (threshold > 75) {
      console.log(`   Try a lower threshold: --threshold=${threshold - 5}`);
    }
  }
  console.log();
}

main()
  .catch((err) => {
    console.error("\n❌ Propagation failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

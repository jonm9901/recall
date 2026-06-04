/**
 * Recall Vision Tagging Pipeline — Phase 8
 *
 * For each un-vision-tagged photo:
 *   1. Fetch thumbnail bytes from SmugMug CDN
 *   2. Send to Gemini 2.0 Flash with existing Rekognition tags as context
 *   3. Parse caption + new tags from JSON response
 *   4. Save tags (source = "gemini_vision") and update Photo.caption + visionTaggedAt
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/vision-tag-photos.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { GoogleGenerativeAI } from "@google/generative-ai";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const data = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = ct.split(";")[0].trim();
    return { data, mimeType };
  } catch {
    return null;
  }
}

type VisionResult = {
  caption: string;
  tags: string[];
};

async function tagPhoto(photo: {
  id: string;
  thumbnailUrl: string;
  existingTags: string[];
}): Promise<VisionResult | null> {
  const image = await fetchBase64(photo.thumbnailUrl);
  if (!image) {
    console.warn(`  [skip] could not fetch image for ${photo.id}`);
    return null;
  }

  const existingContext =
    photo.existingTags.length > 0
      ? `Rekognition has already detected: ${photo.existingTags.slice(0, 15).join(", ")}. Focus on what's missing.`
      : "No prior tags available.";

  const prompt = `Analyze this photo and respond with valid JSON only — no markdown, no explanation.

${existingContext}

Return exactly this shape:
{
  "caption": "One or two sentence description of the photo.",
  "tags": ["tag1", "tag2", "tag3"]
}

Tags should cover what Rekognition misses: occasion (birthday, wedding, graduation, holiday, reunion, etc.), activity (hiking, skiing, swimming, cooking, dancing, etc.), season (spring, summer, fall, winter), setting (beach, mountains, city, home, restaurant, park, school, etc.), and any notable specific subjects. Include 3–10 tags. Use lowercase.`;

  try {
    const result = await model.generateContent([
      { inlineData: { data: image.data, mimeType: image.mimeType } },
      prompt,
    ]);
    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean) as VisionResult;
    if (typeof parsed.caption !== "string" || !Array.isArray(parsed.tags)) {
      throw new Error("Unexpected shape");
    }
    return parsed;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
      throw new Error(`QUOTA_EXCEEDED: ${msg}`);
    }
    if (msg.includes("blocked") || msg.includes("PROHIBITED") || msg.includes("Text not available")) {
      throw new Error(`BLOCKED: ${msg}`);
    }
    console.warn(`  [parse error] ${photo.id}: ${err}`);
    return null;
  }
}

async function main() {
  const total = await prisma.photo.count({ where: { visionTaggedAt: null, hidden: false } });
  console.log(`\nVision tagging: ${total} photos to process\n`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (true) {
    const photos = await prisma.photo.findMany({
      where: { visionTaggedAt: null, hidden: false },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      select: {
        id: true,
        thumbnailUrl: true,
        tags: {
          where: { source: "rekognition" },
          select: { tag: true },
          orderBy: { confidence: "desc" },
          take: 20,
        },
      },
    });

    if (photos.length === 0) break;

    for (const photo of photos) {
      processed++;
      const existingTags = photo.tags.map((t: { tag: string }) => t.tag);
      process.stdout.write(`[${processed}/${total}] ${photo.id} … `);

      let result;
      try {
        result = await tagPhoto({ id: photo.id, thumbnailUrl: photo.thumbnailUrl, existingTags });
      } catch (err) {
        const msg = String(err);
        if (msg.includes("QUOTA_EXCEEDED")) {
          console.log("\n⚠️  Daily quota exceeded. Resume tomorrow. Progress saved.\n");
          break;
        }
        if (msg.includes("BLOCKED")) {
          // Mark as done so it's not retried endlessly
          await prisma.photo.update({ where: { id: photo.id }, data: { visionTaggedAt: new Date() } });
          failed++;
          console.log("blocked (skipped)");
          continue;
        }
        throw err;
      }

      if (!result) {
        // Leave visionTaggedAt null so it will be retried next run
        failed++;
        console.log("skipped (will retry)");
        continue;
      }

      // Save tags — no transaction needed; operations are idempotent on re-run
      const tagRows = result.tags.map((tag: string) => ({
        photoId: photo.id,
        tag: tag.toLowerCase().trim(),
        confidence: null,
        source: "gemini_vision",
      }));

      await prisma.photoTag.deleteMany({ where: { photoId: photo.id, source: "gemini_vision" } });
      if (tagRows.length > 0) {
        await prisma.photoTag.createMany({ data: tagRows });
      }
      await prisma.photo.update({
        where: { id: photo.id },
        data: { caption: result.caption, visionTaggedAt: new Date() },
      });

      succeeded++;
      console.log(`ok — "${result.caption.slice(0, 60)}…" [${result.tags.join(", ")}]`);
    }

    if (photos.length === BATCH_SIZE) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed out of ${processed} processed.\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

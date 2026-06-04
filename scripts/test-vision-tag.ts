/**
 * Quick smoke test for vision-tag-photos pipeline.
 * Fetches 3 photos, runs them through Gemini, prints results — no DB writes.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/test-vision-tag.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { GoogleGenerativeAI } from "@google/generative-ai";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

async function fetchBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return {
      data: Buffer.from(buf).toString("base64"),
      mimeType: (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim(),
    };
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌  GEMINI_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const photos = await prisma.photo.findMany({
    where: { hidden: false, indexedAt: { not: null } },
    take: 3,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      thumbnailUrl: true,
      tags: { where: { source: "rekognition" }, select: { tag: true }, orderBy: { confidence: "desc" }, take: 10 },
    },
  });

  console.log(`\nTesting with ${photos.length} photos…\n`);

  for (const photo of photos) {
    const existingTags = photo.tags.map((t: { tag: string }) => t.tag);
    console.log(`── Photo ${photo.id}`);
    console.log(`   URL: ${photo.thumbnailUrl}`);
    console.log(`   Rekognition tags: ${existingTags.join(", ") || "(none)"}`);

    const image = await fetchBase64(photo.thumbnailUrl);
    if (!image) { console.log("   ❌  Could not fetch image\n"); continue; }

    const existingContext = existingTags.length > 0
      ? `Rekognition has already detected: ${existingTags.join(", ")}. Focus on what's missing.`
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
      const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(clean) as { caption: string; tags: string[] };

      console.log(`   ✅  Caption: "${parsed.caption}"`);
      console.log(`   ✅  Tags: ${parsed.tags.join(", ")}`);
    } catch (err) {
      console.log(`   ❌  Error: ${err}`);
    }
    console.log();
  }

  await prisma.$disconnect();
  console.log("Done — no DB changes made.");
}

main().catch((err) => { console.error(err); process.exit(1); });

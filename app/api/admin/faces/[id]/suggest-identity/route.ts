import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.AI_RATING_API_KEY });
const MODEL = process.env.AI_RATING_MODEL ?? "claude-haiku-4-5-20251001";

// POST /api/admin/faces/[id]/suggest-identity
// Uses co-occurrence patterns and gallery context to suggest who an unnamed person might be.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Load all photos this person appears in, with gallery + location context
  const personPhotos = await prisma.photoPerson.findMany({
    where: { personId: id, photo: { hidden: false } },
    select: {
      photoId: true,
      photo: {
        select: {
          takenAt: true,
          city: true,
          region: true,
          country: true,
          gallery: { select: { title: true } },
        },
      },
    },
  });

  if (personPhotos.length === 0) {
    return NextResponse.json({ error: "No photos found for this person" }, { status: 404 });
  }

  // Find named people who appear in the same photos (co-occurrence)
  const photoIds = personPhotos.map((pp) => pp.photoId);
  const coPersonLinks = await prisma.photoPerson.findMany({
    where: {
      photoId: { in: photoIds },
      personId: { not: id },
      person: { name: { not: "" } },
    },
    select: {
      personId: true,
      person: { select: { name: true } },
    },
  });

  // Tally co-occurrences
  const coCounts = new Map<string, { name: string; count: number }>();
  for (const link of coPersonLinks) {
    const entry = coCounts.get(link.personId);
    if (entry) entry.count++;
    else coCounts.set(link.personId, { name: link.person.name, count: 1 });
  }
  const topCoOccurrents = [...coCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Summarise gallery titles, locations, and date range
  const galleryCounts = new Map<string, number>();
  const locations = new Set<string>();
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const pp of personPhotos) {
    const title = pp.photo.gallery.title;
    galleryCounts.set(title, (galleryCounts.get(title) ?? 0) + 1);

    if (pp.photo.city) {
      const loc = [pp.photo.city, pp.photo.region, pp.photo.country]
        .filter(Boolean)
        .join(", ");
      locations.add(loc);
    }

    if (pp.photo.takenAt) {
      const d = new Date(pp.photo.takenAt);
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
  }

  const topGalleries = [...galleryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([title]) => title);

  const dateRange =
    earliest && latest
      ? earliest.getFullYear() === latest.getFullYear()
        ? String(earliest.getFullYear())
        : `${earliest.getFullYear()}–${latest.getFullYear()}`
      : "unknown";

  const coOccurrentText =
    topCoOccurrents.length > 0
      ? topCoOccurrents
          .map((c) => `${c.name} (${c.count} shared photo${c.count !== 1 ? "s" : ""})`)
          .join(", ")
      : "none identified";

  const locationText =
    locations.size > 0 ? [...locations].slice(0, 6).join("; ") : "unknown";

  const prompt = `You are helping identify an unnamed person in a personal family photo archive.

Facts about this unnamed person:
- Appears in ${personPhotos.length} photo${personPhotos.length !== 1 ? "s" : ""}, spanning ${dateRange}
- Gallery titles they appear in (most frequent first): ${topGalleries.join(" | ")}
- Locations they appear in: ${locationText}
- Named people they most often appear with: ${coOccurrentText}

Task: Based on co-occurrence patterns and gallery context, infer who this person might be.
Strong co-occurrence with a named person (especially a spouse surname match, sibling-age range, or repeated family events) is your primary signal.
If co-occurrence data is weak or ambiguous, say so and return null for suggestedName.

Respond with ONLY a JSON object — no markdown fences, no text outside the JSON:
{"suggestedName": "<full name, or null if cannot reasonably guess>", "reasoning": "<1–2 sentences explaining the inference>", "confidence": "high|medium|low"}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed: { suggestedName: string | null; reasoning: string; confidence: string };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json({
    suggestedName: parsed.suggestedName ?? null,
    reasoning: parsed.reasoning ?? "",
    confidence: parsed.confidence ?? "low",
    context: {
      photoCount: personPhotos.length,
      topCoOccurrents: topCoOccurrents.slice(0, 5),
    },
  });
}

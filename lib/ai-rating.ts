import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.AI_RATING_API_KEY });
const MODEL = process.env.AI_RATING_MODEL ?? "claude-haiku-4-5-20251001";

export interface AiRatingResult {
  stars: number;       // 1–5
  reason: string;      // one sentence
}

export async function getAiRating(thumbnailUrl: string): Promise<AiRatingResult> {
  // Fetch image bytes and base64-encode
  const imgRes = await fetch(thumbnailUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch thumbnail: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = imgRes.headers.get("content-type") ?? "image/jpeg";

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 128,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
          },
          {
            type: "text",
            text: `Rate this photo on a scale of 1 to 5 stars based on composition, clarity, lighting, and overall quality. Respond with ONLY a JSON object in this exact format (no markdown, no explanation outside the JSON):
{"stars": <1-5>, "reason": "<one concise sentence explaining the rating>"}`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // Parse JSON — strip any accidental markdown fences
  const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(jsonStr) as { stars: unknown; reason: unknown };

  const stars = Math.min(5, Math.max(1, Math.round(Number(parsed.stars))));
  const reason = typeof parsed.reason === "string" ? parsed.reason : "";

  return { stars, reason };
}

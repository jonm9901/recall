"use client";

import { useState } from "react";

interface IndexStats {
  total: number;
  indexed: number;
  unindexed: number;
  faceCount: number;
  tagCount: number;
  geocodedCount: number;
  lastIndexedAt: string | null;
}

interface VisionStats {
  total: number;
  visionTagged: number;
  visionUntagged: number;
  lastVisionTaggedAt: string | null;
}

export default function IndexClient({ initial, initialVision }: { initial: IndexStats; initialVision: VisionStats }) {
  const [stats, setStats] = useState(initial);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const [visionStats, setVisionStats] = useState(initialVision);
  const [visionRunning, setVisionRunning] = useState(false);
  const [visionMessage, setVisionMessage] = useState("");

  async function refreshStats() {
    const res = await fetch("/api/admin/index");
    if (res.ok) setStats(await res.json());
  }

  async function refreshVisionStats() {
    const res = await fetch("/api/admin/vision-tag");
    if (res.ok) setVisionStats(await res.json());
  }

  async function startIndexing() {
    setRunning(true);
    setMessage("");
    const res = await fetch("/api/admin/index", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setMessage(`Error: ${data.error}`); setRunning(false); return; }
    setMessage("Indexing started in the background. Counts update every 30 seconds.");
    const interval = setInterval(refreshStats, 30000);
    setTimeout(() => { clearInterval(interval); setRunning(false); }, 12 * 60 * 60 * 1000);
  }

  async function startVisionTagging() {
    setVisionRunning(true);
    setVisionMessage("");
    const res = await fetch("/api/admin/vision-tag", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setVisionMessage(`Error: ${data.error}`); setVisionRunning(false); return; }
    setVisionMessage("Vision tagging started in the background. ~1–2 photos/sec. Counts update every 30 seconds.");
    const interval = setInterval(refreshVisionStats, 30000);
    setTimeout(() => { clearInterval(interval); setVisionRunning(false); }, 12 * 60 * 60 * 1000);
  }

  const pct = stats.total > 0 ? Math.round((stats.indexed / stats.total) * 100) : 0;
  const visionPct = visionStats.total > 0 ? Math.round((visionStats.visionTagged / visionStats.total) * 100) : 0;

  return (
    <div className="space-y-10">
      {/* ── Rekognition indexing ── */}
      <div className="space-y-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Rekognition indexing</h2>

        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{stats.indexed.toLocaleString()} indexed</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.unindexed.toLocaleString()} remaining of {stats.total.toLocaleString()} total
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Photos indexed", value: stats.indexed.toLocaleString() },
            { label: "Faces found", value: stats.faceCount.toLocaleString() },
            { label: "Tags saved", value: stats.tagCount.toLocaleString() },
            { label: "Photos geocoded", value: stats.geocodedCount.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-4">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {stats.lastIndexedAt && (
          <p className="text-sm text-gray-500">
            Last indexed:{" "}
            {new Date(stats.lastIndexedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={startIndexing}
            disabled={running}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {running ? "Indexing…" : stats.unindexed > 0 ? "Start indexing" : "Re-index all"}
          </button>
          <button onClick={refreshStats} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors">
            Refresh counts
          </button>
        </div>

        {message && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">{message}</div>
        )}

        <div className="text-sm text-gray-500 space-y-1">
          <p>Each photo gets scene tags (DetectLabels) and face detection (IndexFaces) via AWS Rekognition.</p>
          <p>Photos with GPS coordinates are reverse-geocoded to city/region/country via OpenStreetMap.</p>
          <p>Re-running is safe — already-indexed photos are skipped automatically.</p>
        </div>
      </div>

      {/* ── Gemini vision tagging ── */}
      <div className="space-y-6 border-t border-gray-800 pt-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Gemini vision tagging</h2>

        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{visionStats.visionTagged.toLocaleString()} tagged</span>
            <span>{visionPct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${visionPct}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {visionStats.visionUntagged.toLocaleString()} remaining of {visionStats.total.toLocaleString()} total
          </div>
        </div>

        {visionStats.lastVisionTaggedAt && (
          <p className="text-sm text-gray-500">
            Last tagged:{" "}
            {new Date(visionStats.lastVisionTaggedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={startVisionTagging}
            disabled={visionRunning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {visionRunning ? "Running…" : visionStats.visionUntagged > 0 ? "Start vision tagging" : "Re-tag all"}
          </button>
          <button onClick={refreshVisionStats} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors">
            Refresh counts
          </button>
        </div>

        {visionMessage && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">{visionMessage}</div>
        )}

        <div className="text-sm text-gray-500 space-y-1">
          <p>Each photo gets a caption and contextual tags (occasion, activity, season, setting) via Gemini 2.5 Flash.</p>
          <p>Existing Rekognition tags are passed as context so Gemini focuses on what&apos;s missing.</p>
          <p>Re-running is safe — already-tagged photos are skipped. ~$8–12 for all 39,700 photos.</p>
        </div>
      </div>
    </div>
  );
}

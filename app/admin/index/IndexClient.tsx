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

export default function IndexClient({ initial }: { initial: IndexStats }) {
  const [stats, setStats] = useState(initial);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStats() {
    const res = await fetch("/api/admin/index");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  async function startIndexing() {
    setRunning(true);
    setMessage("");

    const res = await fetch("/api/admin/index", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      setRunning(false);
      return;
    }

    setMessage(
      "Indexing started in the background. With ~500ms per photo this will take several hours for a full run. Counts update every 30 seconds."
    );

    const interval = setInterval(refreshStats, 30000);
    // Stop polling after 12 hours
    setTimeout(() => {
      clearInterval(interval);
      setRunning(false);
    }, 12 * 60 * 60 * 1000);
  }

  const pct = stats.total > 0 ? Math.round((stats.indexed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{stats.indexed.toLocaleString()} indexed</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {stats.unindexed.toLocaleString()} remaining of {stats.total.toLocaleString()} total
        </div>
      </div>

      {/* Stats grid */}
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
          {new Date(stats.lastIndexedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={startIndexing}
          disabled={running}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {running ? "Indexing…" : stats.unindexed > 0 ? "Start indexing" : "Re-index all"}
        </button>
        <button
          onClick={refreshStats}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Refresh counts
        </button>
      </div>

      {message && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">
          {message}
        </div>
      )}

      <div className="text-sm text-gray-500 space-y-1">
        <p>Each photo gets scene tags (DetectLabels) and face detection (IndexFaces) via AWS Rekognition.</p>
        <p>Photos with GPS coordinates are reverse-geocoded to city/region/country via OpenStreetMap.</p>
        <p>Re-running is safe — already-indexed photos are skipped automatically.</p>
      </div>
    </div>
  );
}

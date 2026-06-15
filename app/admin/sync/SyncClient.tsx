"use client";

import { useState } from "react";

interface SyncStats {
  galleryCount: number;
  photoCount: number;
  excludedCount: number;
  lastSyncAt: string | null;
}

interface SyncResult {
  galleriesChecked: number;
  galleriesUpdated: number;
  galleriesSkipped: number;
  galleriesExcluded: number;
  photosSynced: number;
  photosFailed: number;
  elapsedMs: number;
}

export default function SyncClient({ initial }: { initial: SyncStats }) {
  const [stats, setStats] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  async function refreshStats() {
    const res = await fetch("/api/admin/sync");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  async function startSync() {
    setSyncing(true);
    setResult(null);
    setError("");

    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();

    if (res.ok && data.result) {
      setResult(data.result);
      await refreshStats();
    } else {
      setError(data.error ?? "Sync failed.");
    }

    setSyncing(false);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Galleries synced", value: stats.galleryCount },
          { label: "Photos synced", value: stats.photoCount },
          { label: "Galleries excluded", value: stats.excludedCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4">
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {stats.lastSyncAt && (
        <p className="text-sm text-gray-500">
          Last synced:{" "}
          {new Date(stats.lastSyncAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={startSync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {syncing ? "Syncing…" : "Start sync"}
        </button>
        <button
          onClick={refreshStats}
          disabled={syncing}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Refresh counts
        </button>
      </div>

      {syncing && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">
          Checking galleries against SmugMug and syncing any changes…
        </div>
      )}

      {result && !syncing && (
        <div className="bg-gray-900 border border-green-800 rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="text-green-400 font-medium">
            Sync complete in {(result.elapsedMs / 1000).toFixed(1)}s
          </p>
          <div className="text-gray-300 grid grid-cols-2 gap-x-6 gap-y-0.5 mt-2">
            <span>Galleries checked</span><span>{result.galleriesChecked}</span>
            <span>Galleries updated</span><span>{result.galleriesUpdated}</span>
            <span>Galleries skipped (no change)</span><span>{result.galleriesSkipped}</span>
            <span>Galleries excluded</span><span>{result.galleriesExcluded}</span>
            <span>Photos synced</span><span>{result.photosSynced}</span>
            {result.photosFailed > 0 && (
              <><span className="text-yellow-400">Photos failed</span><span className="text-yellow-400">{result.photosFailed}</span></>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-gray-900 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-500 space-y-1">
        <p>Incremental sync — only fetches photos for galleries where the count changed. Typically completes in seconds.</p>
        <p>Galleries protected by a secondary password are automatically skipped and counted as excluded.</p>
        <p>For large bulk imports, use the GitHub Actions workflow instead.</p>
      </div>
    </div>
  );
}

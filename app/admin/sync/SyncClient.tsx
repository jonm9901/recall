"use client";

import { useState } from "react";

interface SyncStats {
  galleryCount: number;
  photoCount: number;
  excludedCount: number;
  lastSyncAt: string | null;
}

export default function SyncClient({ initial }: { initial: SyncStats }) {
  const [stats, setStats] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStats() {
    const res = await fetch("/api/admin/sync");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  async function startSync() {
    setSyncing(true);
    setMessage("");

    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      setMessage(
        "Sync started in the background. This can take several minutes for large libraries. Refresh the counts below when done."
      );
    } else {
      setMessage(`Error: ${data.error}`);
      setSyncing(false);
      return;
    }

    // Poll stats every 10s while syncing
    const interval = setInterval(async () => {
      await refreshStats();
    }, 10000);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setSyncing(false);
    }, 600000);
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
        <p>The sync runs in the background and may take several minutes for 39,000+ photos.</p>
        <p>Galleries protected by a secondary password are automatically skipped and counted as excluded.</p>
        <p>Re-running sync is safe — it upserts records and skips already-indexed photos.</p>
      </div>
    </div>
  );
}

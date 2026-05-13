"use client";

import { useState } from "react";

export default function InviteSection({
  atCap,
  maxUsers,
}: {
  atCap: boolean;
  maxUsers: number;
}) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function generateInvite() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/invite", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to generate invite.");
    } else {
      setLink(data.link);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (atCap) {
    return (
      <div className="bg-amber-950 border border-amber-800 rounded-xl px-5 py-4 text-amber-300 text-sm">
        User limit of {maxUsers} reached. Invite link generation is disabled.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-5">
      <h2 className="font-medium mb-1">Invite someone</h2>
      <p className="text-sm text-gray-400 mb-4">
        Generate a single-use link that expires in 7 days.
      </p>

      {!link ? (
        <button
          onClick={generateInvite}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Generating…" : "Generate invite link"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono truncate"
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => { setLink(""); generateInvite(); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Generate a new link
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  );
}

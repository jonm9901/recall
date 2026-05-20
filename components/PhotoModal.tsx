"use client";

import { useEffect, useState, useCallback } from "react";
import type { Photo } from "./PhotoGrid";

const GENERIC_TAGS = new Set([
  "Person", "Adult", "Clothing", "People", "Male", "Female", "Man", "Woman",
  "Head", "Face", "Photography", "Portrait", "Accessories", "Baby", "Child",
  "Indoors", "Outdoors",
]);

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function locationLabel(photo: Photo) {
  const parts = [photo.city, photo.region, photo.country].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (photo.locationName) return photo.locationName;
  return null;
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className="text-xl leading-none disabled:cursor-default transition-transform hover:scale-110"
          title={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <span className={display >= star ? "text-yellow-400" : "text-gray-700"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

export default function PhotoModal({ photo, onClose, onHide }: { photo: Photo; onClose: () => void; onHide?: (photoId: string) => void }) {
  const [userStars, setUserStars] = useState<number | null>(null);
  const [hiding, setHiding] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(photo.avgRating);
  const [aiStars, setAiStars] = useState<number | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [loadingRating, setLoadingRating] = useState(true);
  const [savingRating, setSavingRating] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch current rating on open
  const fetchRating = useCallback(async () => {
    setLoadingRating(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/rating`);
      if (!res.ok) return;
      const data = await res.json();
      setUserStars(data.userStars);
      setAvgRating(data.avgRating);
      setAiStars(data.aiSuggestedStars);
      setAiReason(data.aiSuggestedReason);
    } finally {
      setLoadingRating(false);
    }
  }, [photo.id]);

  useEffect(() => { fetchRating(); }, [fetchRating]);

  async function handleRate(stars: number) {
    setSavingRating(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUserStars(stars);
      setAvgRating(data.avgRating);
    } finally {
      setSavingRating(false);
    }
  }

  async function handleAiSuggest() {
    setLoadingAi(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/ai-suggest`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setAiStars(data.aiSuggestedStars);
      setAiReason(data.aiSuggestedReason);
    } finally {
      setLoadingAi(false);
    }
  }

  const meaningfulTags = photo.tags
    .filter((t) => !GENERIC_TAGS.has(t.tag))
    .slice(0, 12);

  const location = locationLabel(photo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row bg-gray-950 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo */}
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
          <img
            src={photo.imageUrl}
            alt={photo.gallery.title}
            className="max-w-full max-h-[70vh] md:max-h-[90vh] object-contain"
          />
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-72 flex-shrink-0 overflow-y-auto p-5 space-y-4 border-t md:border-t-0 md:border-l border-gray-800">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>

          {/* Gallery */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Gallery</div>
            {photo.gallery.smugmugUrl ? (
              <a href={photo.gallery.smugmugUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300">
                {photo.gallery.title}
              </a>
            ) : (
              <div className="text-sm text-gray-300">{photo.gallery.title}</div>
            )}
          </div>

          {/* Date */}
          {photo.takenAt && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</div>
              <div className="text-sm text-gray-300">{formatDate(photo.takenAt)}</div>
            </div>
          )}

          {/* Location */}
          {location && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Location</div>
              <div className="text-sm text-gray-300">{location}</div>
            </div>
          )}

          {/* Rating */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your Rating</div>
            {loadingRating ? (
              <div className="text-xs text-gray-600">Loading…</div>
            ) : (
              <StarRating value={userStars} onChange={handleRate} disabled={savingRating} />
            )}
            {avgRating !== null && (
              <div className="text-xs text-gray-600 mt-1">
                Avg: {avgRating.toFixed(1)} ★
              </div>
            )}
          </div>

          {/* AI Suggestion */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">AI Rating</div>
            {aiStars !== null ? (
              <div className="space-y-1">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`text-lg ${aiStars >= s ? "text-yellow-500/70" : "text-gray-700"}`}>★</span>
                  ))}
                  <button
                    onClick={() => handleRate(aiStars)}
                    disabled={savingRating || userStars === aiStars}
                    className="ml-2 text-xs text-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {aiReason && <p className="text-xs text-gray-500 leading-relaxed">{aiReason}</p>}
              </div>
            ) : (
              <button
                onClick={handleAiSuggest}
                disabled={loadingAi}
                className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
              >
                {loadingAi ? "Asking Claude…" : "Get AI suggestion"}
              </button>
            )}
          </div>

          {/* People */}
          {photo.people.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">People</div>
              <div className="flex flex-wrap gap-1">
                {photo.people.map((pp) => (
                  <span key={pp.person.id}
                    className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                    {pp.person.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {meaningfulTags.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tags</div>
              <div className="flex flex-wrap gap-1">
                {meaningfulTags.map((t) => (
                  <span key={t.tag}
                    className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Open full resolution */}
          <div className="pt-2">
            <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Open full resolution ↗
            </a>
          </div>

          {/* Hide */}
          <div className="pt-2 border-t border-gray-800">
            <button
              disabled={hiding}
              onClick={async () => {
                setHiding(true);
                try {
                  const res = await fetch(`/api/photos/${photo.id}/hide`, { method: "POST" });
                  if (res.ok) onHide?.(photo.id);
                } finally {
                  setHiding(false);
                }
              }}
              className="text-xs text-red-600 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              {hiding ? "Hiding…" : "Hide this photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import PhotoModal from "./PhotoModal";
import type { Photo } from "./PhotoGrid";

const GENERIC_TAGS = new Set([
  "Person", "Adult", "Clothing", "People", "Male", "Female", "Man", "Woman",
  "Head", "Face", "Photography", "Portrait", "Accessories", "Baby", "Child",
  "Indoors", "Outdoors",
]);

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function PhotoList({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<Photo | null>(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No photos found. Try a different search.
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-800">
        {photos.map((photo) => {
          const meaningfulTags = photo.tags.filter((t) => !GENERIC_TAGS.has(t.tag)).slice(0, 6);
          const location = [photo.city, photo.region, photo.country].filter(Boolean).join(", ")
            || photo.locationName || null;

          return (
            <button
              key={photo.id}
              onClick={() => setSelected(photo)}
              className="w-full flex items-center gap-4 py-3 px-1 hover:bg-gray-900 transition-colors text-left"
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.gallery.title}
                className="w-16 h-16 object-cover rounded flex-shrink-0 bg-gray-800"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">{photo.gallery.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatDate(photo.takenAt)}
                  {location && <span className="ml-2 text-gray-600">· {location}</span>}
                </div>
                {meaningfulTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meaningfulTags.map((t) => (
                      <span key={t.tag} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                        {t.tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {photo.people.length > 0 && (
                <div className="flex-shrink-0 text-xs text-gray-500">
                  {photo.people.map((pp) => pp.person.name).join(", ")}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <PhotoModal photo={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

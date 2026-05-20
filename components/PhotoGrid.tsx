"use client";

import { useState } from "react";
import PhotoModal from "./PhotoModal";

export interface Photo {
  id: string;
  thumbnailUrl: string;
  imageUrl: string;
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  avgRating: number | null;
  gallery: { id: string; title: string; smugmugUrl: string | null };
  tags: { tag: string; confidence: number }[];
  people: { person: { id: string; name: string }; confidence: number }[];
}

export default function PhotoGrid({ photos: initialPhotos }: { photos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);

  async function handleHide(e: React.MouseEvent, photoId: string) {
    e.stopPropagation();
    setHidingId(photoId);
    try {
      const res = await fetch(`/api/photos/${photoId}/hide`, { method: "POST" });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        if (selected?.id === photoId) setSelected(null);
      }
    } finally {
      setHidingId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No photos found. Try a different search.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square bg-gray-900">
            <button
              onClick={() => setSelected(photo)}
              className="w-full h-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.gallery.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
            <button
              onClick={(e) => handleHide(e, photo.id)}
              disabled={hidingId === photo.id}
              className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 hover:text-red-200 transition-all disabled:opacity-40"
              title="Hide photo"
            >
              {hidingId === photo.id ? "…" : "Hide"}
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <PhotoModal
          photo={selected}
          onClose={() => setSelected(null)}
          onHide={(photoId) => {
            setPhotos((prev) => prev.filter((p) => p.id !== photoId));
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

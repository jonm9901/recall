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

export default function PhotoGrid({ photos }: { photos: Photo[] }) {
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
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo)}
            className="aspect-square overflow-hidden bg-gray-900 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
          >
            <img
              src={photo.thumbnailUrl}
              alt={photo.gallery.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {selected && (
        <PhotoModal photo={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

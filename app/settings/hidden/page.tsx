"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HiddenPhoto = {
  id: string;
  thumbnailUrl: string;
  takenAt: string | null;
  updatedAt: string;
  gallery: { title: string };
};

export default function HiddenPhotosPage() {
  const [photos, setPhotos] = useState<HiddenPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [unhidingId, setUnhidingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/hidden-photos")
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos))
      .finally(() => setLoading(false));
  }, []);

  async function handleUnhide(photoId: string) {
    setUnhidingId(photoId);
    try {
      const res = await fetch("/api/admin/hidden-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } finally {
      setUnhidingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/settings/users" className="text-gray-400 hover:text-white text-sm">← Settings</Link>
        <span className="font-bold text-lg tracking-tight">Hidden Photos</span>
        {!loading && <span className="text-sm text-gray-500">{photos.length} hidden</span>}
      </header>

      <main className="px-6 py-6 max-w-6xl mx-auto">
        {loading && <div className="text-gray-500 text-sm">Loading…</div>}

        {!loading && photos.length === 0 && (
          <div className="text-center py-20 text-gray-500 text-sm">No hidden photos.</div>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.gallery.title}
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity"
                  />
                </div>
                <div className="mt-1 text-xs text-gray-600 truncate" title={photo.gallery.title}>
                  {photo.gallery.title}
                </div>
                {photo.takenAt && (
                  <div className="text-xs text-gray-700">
                    {new Date(photo.takenAt).toLocaleDateString()}
                  </div>
                )}
                <button
                  onClick={() => handleUnhide(photo.id)}
                  disabled={unhidingId === photo.id}
                  className="mt-1 w-full text-xs text-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
                >
                  {unhidingId === photo.id ? "…" : "Unhide"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

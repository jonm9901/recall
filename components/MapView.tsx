"use client";

import { useState, useEffect } from "react";
import type { Photo } from "./PhotoGrid";
import PhotoModal from "./PhotoModal";

export default function MapView({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet")["MapContainer"];
    TileLayer: typeof import("react-leaflet")["TileLayer"];
    Marker: typeof import("react-leaflet")["Marker"];
    Popup: typeof import("react-leaflet")["Popup"];
  } | null>(null);

  // Dynamically import leaflet (SSR-incompatible)
  useEffect(() => {
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
    ]).then(([rl, L]) => {
      // Fix default marker icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setMapComponents({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Marker: rl.Marker,
        Popup: rl.Popup,
      });
    });
  }, []);

  const geoPhotos = photos.filter((p) => p.lat && p.lng);

  if (geoPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 text-sm">
        No photos with GPS coordinates in these results.
      </div>
    );
  }

  if (!MapComponents) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 text-sm">
        Loading map…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  const center: [number, number] = [
    geoPhotos.reduce((s, p) => s + p.lat!, 0) / geoPhotos.length,
    geoPhotos.reduce((s, p) => s + p.lng!, 0) / geoPhotos.length,
  ];

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{ height: "60vh" }}>
        <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoPhotos.map((photo) => (
            <Marker key={photo.id} position={[photo.lat!, photo.lng!]}>
              <Popup>
                <div className="text-sm">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.gallery.title}
                    className="w-32 h-24 object-cover rounded mb-1 cursor-pointer"
                    onClick={() => setSelected(photo)}
                  />
                  <div className="font-medium">{photo.gallery.title}</div>
                  {photo.takenAt && (
                    <div className="text-gray-500 text-xs">
                      {new Date(photo.takenAt).toLocaleDateString()}
                    </div>
                  )}
                  <button
                    onClick={() => setSelected(photo)}
                    className="text-blue-600 text-xs mt-1 hover:underline"
                  >
                    View photo
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="text-xs text-gray-600 mt-2">{geoPhotos.length} photos with GPS data shown</div>

      {selected && <PhotoModal photo={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

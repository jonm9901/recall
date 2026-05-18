export interface GeocodedLocation {
  city?: string;
  region?: string;
  country?: string;
}

// Forward geocode a place name string using Nominatim.
// Rate limit: max 1 req/second; callers are responsible for throttling.
export async function forwardGeocode(locationName: string): Promise<GeocodedLocation> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Recall Personal Photo App (personal use only)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (!data.length) return {};
    const addr = data[0].address ?? {};
    return {
      city:
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        undefined,
      region: addr.state || undefined,
      country: addr.country || undefined,
    };
  } catch {
    return {};
  }
}

// Reverse geocode using Nominatim (OpenStreetMap) — free, no API key required.
// Rate limit: max 1 req/second; callers are responsible for throttling.
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Recall Personal Photo App (personal use only)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const addr = data.address ?? {};
    return {
      city:
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        undefined,
      region: addr.state || undefined,
      country: addr.country || undefined,
    };
  } catch {
    return {};
  }
}

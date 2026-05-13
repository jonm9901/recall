import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OAuth = require("oauth-1.0a");

const API_BASE = "https://api.smugmug.com/api/v2";

function getAlbumBaseUrl(): string {
  const raw = process.env.SMUGMUG_ALBUM_BASE_URL || "";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function getOAuthClient() {
  return new OAuth({
    consumer: {
      key: process.env.SMUGMUG_API_KEY!.trim(),
      secret: process.env.SMUGMUG_API_SECRET!.trim(),
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string: string, key: string) {
      return crypto.createHmac("sha1", key).update(base_string).digest("base64");
    },
  });
}

function getAccessToken() {
  return {
    key: process.env.SMUGMUG_ACCESS_TOKEN!.trim(),
    secret: process.env.SMUGMUG_ACCESS_SECRET!.trim(),
  };
}

export async function smugmugGet<T = unknown>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const oauth = getOAuthClient();
  const authHeader = oauth.toHeader(
    oauth.authorize({ url, method: "GET" }, getAccessToken())
  );

  const res = await fetch(url, {
    headers: {
      ...authHeader,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`SmugMug API error ${res.status} for ${url}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Sets the SmugMug site-password cookie so CDN images load in the browser.
 * Called server-side during NextAuth session creation.
 * Returns the Set-Cookie header value to be forwarded to the client.
 */
export async function getSmugmugCookieAuthHeader(): Promise<string | null> {
  const sitePassword = process.env.SMUGMUG_SITE_PASSWORD;
  const albumBaseUrl = getAlbumBaseUrl();
  if (!sitePassword || !albumBaseUrl) return null;

  try {
    const endpoint = `${albumBaseUrl}/services/api/json/1.4.0/`;
    const body = new URLSearchParams({
      method: "smugmug.auth.login",
      SitePassword: sitePassword,
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const setCookie = res.headers.get("set-cookie");
    return setCookie;
  } catch (err) {
    console.error("SmugMug cookie auth failed:", err);
    return null;
  }
}

// ── Album / Photo helpers ──────────────────────────────────────────────────

export interface SmugmugAlbum {
  AlbumKey: string;
  NodeID: string;
  Name: string;
  UrlName: string;
  WebUri: string;
  ImageCount: number;
  SecurityType?: string;
  PasswordHint?: string;
  Uris: {
    AlbumImages?: { Uri: string };
  };
}

export interface SmugmugImage {
  ImageKey: string;
  FileName: string;
  ArchivedUri: string;
  ThumbnailUrl: string;
  WebUri: string;
  DateTimeOriginal?: string;
  DateTimeUploaded?: string;
  Latitude?: number;
  Longitude?: number;
  Uris: {
    ImageSizes?: { Uri: string };
    ImageExif?: { Uri: string };
  };
}

interface AlbumListResponse {
  Response: {
    Album?: SmugmugAlbum[];
    Pages?: { Total: number; Start: number; Count: number; NextPage?: string };
  };
}

interface AlbumImagesResponse {
  Response: {
    AlbumImage?: SmugmugImage[];
    Pages?: { Total: number; Start: number; Count: number; NextPage?: string };
  };
}

interface ImageSizesResponse {
  Response: {
    ImageSizes: {
      LargeImageUrl?: string;
      XLargeImageUrl?: string;
      X2LargeImageUrl?: string;
      X3LargeImageUrl?: string;
      OriginalImageUrl?: string;
      ThumbImageUrl?: string;
      SmallImageUrl?: string;
    };
  };
}

interface ImageExifResponse {
  Response: {
    ImageExif?: {
      GPSLatitude?: number;
      GPSLongitude?: number;
      DateTimeOriginal?: string;
    };
  };
}

export async function fetchAllAlbums(): Promise<SmugmugAlbum[]> {
  // Get authenticated user's nickname first
  const userResp = await smugmugGet<{ Response: { User: { NickName: string } } }>("!authuser");
  const nickname = userResp.Response.User.NickName;

  const albums: SmugmugAlbum[] = [];
  let url: string | null = `${API_BASE}/user/${nickname}!albums?count=100&start=1`;

  while (url) {
    const data: AlbumListResponse = await smugmugGet<AlbumListResponse>(url);
    const page = data.Response;
    albums.push(...(page.Album || []));

    url = page.Pages?.NextPage
      ? `${API_BASE}${page.Pages.NextPage}`
      : null;
  }

  return albums;
}

export async function fetchAlbumImages(album: SmugmugAlbum): Promise<SmugmugImage[]> {
  const images: SmugmugImage[] = [];
  const albumImagesUri = album.Uris.AlbumImages?.Uri;
  if (!albumImagesUri) return images;

  let url: string | null = `${API_BASE}${albumImagesUri}?count=100&start=1`;

  while (url) {
    const data: AlbumImagesResponse = await smugmugGet<AlbumImagesResponse>(url);
    const page = data.Response;
    images.push(...(page.AlbumImage || []));

    url = page.Pages?.NextPage
      ? `${API_BASE}${page.Pages.NextPage}`
      : null;
  }

  return images;
}

export async function fetchImageSizes(image: SmugmugImage): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const sizesUri = image.Uris.ImageSizes?.Uri;
  if (!sizesUri) {
    return { imageUrl: image.ArchivedUri, thumbnailUrl: image.ThumbnailUrl };
  }

  try {
    const data = await smugmugGet<ImageSizesResponse>(`${API_BASE}${sizesUri}`);
    const s = data.Response.ImageSizes;
    const imageUrl =
      s.X3LargeImageUrl ||
      s.X2LargeImageUrl ||
      s.XLargeImageUrl ||
      s.LargeImageUrl ||
      s.OriginalImageUrl ||
      image.ArchivedUri;
    const thumbnailUrl = s.ThumbImageUrl || s.SmallImageUrl || image.ThumbnailUrl;
    return { imageUrl, thumbnailUrl };
  } catch {
    return { imageUrl: image.ArchivedUri, thumbnailUrl: image.ThumbnailUrl };
  }
}

export async function fetchImageExif(
  image: SmugmugImage
): Promise<{ lat?: number; lng?: number; takenAt?: Date }> {
  const exifUri = image.Uris.ImageExif?.Uri;
  if (!exifUri) return {};

  try {
    const data = await smugmugGet<ImageExifResponse>(`${API_BASE}${exifUri}`);
    const exif = data.Response.ImageExif;
    if (!exif) return {};

    return {
      lat: exif.GPSLatitude || undefined,
      lng: exif.GPSLongitude || undefined,
      takenAt: exif.DateTimeOriginal
        ? new Date(exif.DateTimeOriginal)
        : undefined,
    };
  } catch {
    return {};
  }
}

// ── Location parsing from gallery title ───────────────────────────────────

const LOCATION_PATTERNS = [
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+(20\d{2}|19\d{2})\b/,
  /\b(20\d{2}|19\d{2})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
];

export function parseLocationFromTitle(title: string): string | null {
  for (const pattern of LOCATION_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      // Return whichever capture group looks like a place name (not a year)
      for (const group of match.slice(1)) {
        if (group && !/^\d{4}$/.test(group)) return group;
      }
    }
  }
  return null;
}

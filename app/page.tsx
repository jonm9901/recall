"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import PhotoGrid, { type Photo } from "@/components/PhotoGrid";
import PhotoList from "@/components/PhotoList";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = "grid" | "list" | "map";

type NamedPerson = { id: string; name: string; coverPhotoUrl: string | null; photoCount: number };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1993 + 1 }, (_, i) => CURRENT_YEAR - i);

const SUGGESTED_TAGS = [
  "Wedding", "Beach", "Water", "Nature", "Food", "Snow", "Animal",
  "Dog", "Cat", "Car", "Boat", "Pool", "Mountain", "Forest", "City",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [tag, setTag] = useState("");
  const [minRating, setMinRating] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [namedPeople, setNamedPeople] = useState<NamedPerson[]>([]);
  const [peopleExpanded, setPeopleExpanded] = useState(true);
  const [peopleSort, setPeopleSort] = useState<"popular" | "alpha">("popular");
  const [view, setView] = useState<View>("grid");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string, yr: string, tg: string, mr: string, pids: string[], pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (yr) params.set("year", yr);
      if (tg) params.set("tag", tg);
      if (mr) params.set("minRating", mr);
      if (pids.length > 0) params.set("personIds", pids.join(","));
      params.set("page", String(pg));

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setPhotos(data.photos);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    search(query, year, tag, minRating, [...selectedPersonIds], 1);
  }

  function handleTagClick(t: string) {
    const newTag = tag === t ? "" : t;
    setTag(newTag);
    search(query, year, newTag, minRating, [...selectedPersonIds], 1);
  }

  function handleYearChange(yr: string) {
    setYear(yr);
    search(query, yr, tag, minRating, [...selectedPersonIds], 1);
  }

  function handleMinRatingChange(mr: string) {
    setMinRating(mr);
    search(query, year, tag, mr, [...selectedPersonIds], 1);
  }

  function handlePersonToggle(personId: string) {
    const next = new Set(selectedPersonIds);
    next.has(personId) ? next.delete(personId) : next.add(personId);
    setSelectedPersonIds(next);
    search(query, year, tag, minRating, [...next], 1);
  }

  function handleClear() {
    setQuery("");
    setYear("");
    setTag("");
    setMinRating("");
    setSelectedPersonIds(new Set());
    setPhotos([]);
    setSearched(false);
    setTotal(0);
    inputRef.current?.focus();
  }

  // Load named people and recent photos on mount
  useEffect(() => {
    search("", "", "", "", [], 1);
    fetch("/api/admin/faces?filter=named&sort=popular&page=1")
      .then((r) => r.json())
      .then((d) => setNamedPeople(d.persons ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Eye + aperture logo */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Eye whites */}
            <path d="M2 14C2 14 7 5 14 5C21 5 26 14 26 14C26 14 21 23 14 23C7 23 2 14 2 14Z"
              fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
            {/* Iris */}
            <circle cx="14" cy="14" r="5.5" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1"/>
            {/* Aperture blades */}
            <g stroke="#93c5fd" strokeWidth="1" strokeLinecap="round">
              <line x1="14" y1="9" x2="14" y2="11"/>
              <line x1="14" y1="17" x2="14" y2="19"/>
              <line x1="9" y1="14" x2="11" y2="14"/>
              <line x1="17" y1="14" x2="19" y2="14"/>
              <line x1="10.5" y1="10.5" x2="11.9" y2="11.9"/>
              <line x1="16.1" y1="16.1" x2="17.5" y2="17.5"/>
              <line x1="17.5" y1="10.5" x2="16.1" y2="11.9"/>
              <line x1="11.9" y1="16.1" x2="10.5" y2="17.5"/>
            </g>
            {/* Pupil */}
            <circle cx="14" cy="14" r="2" fill="#bfdbfe"/>
            {/* Glint */}
            <circle cx="15.5" cy="12.5" r="0.7" fill="white" opacity="0.8"/>
          </svg>
          <span className="font-bold text-lg tracking-tight">Total Recall</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/stats" className="text-sm text-gray-400 hover:text-white transition-colors">Stats</a>
          <a href="/admin/sync" className="text-sm text-gray-400 hover:text-white transition-colors">Sync</a>
          <a href="/admin/index" className="text-sm text-gray-400 hover:text-white transition-colors">Index</a>
          <a href="/admin/faces" className="text-sm text-gray-400 hover:text-white transition-colors">Faces</a>
          <a href="/settings/users" className="text-sm text-gray-400 hover:text-white transition-colors">Settings</a>
          <a href="/api/auth/signout" className="text-sm text-gray-400 hover:text-white transition-colors">Sign out</a>
        </div>
      </header>

      {/* Search bar */}
      <div className="border-b border-gray-800 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by place, event, tag…"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {(query || year || tag || minRating || selectedPersonIds.size > 0) && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
            )}
          </div>
          {/* Year filter */}
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Rating filter */}
          <select
            value={minRating}
            onChange={(e) => handleMinRatingChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">Any rating</option>
            <option value="5">★★★★★ only</option>
            <option value="4">★★★★ & up</option>
            <option value="3">★★★ & up</option>
            <option value="2">★★ & up</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Tag pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTED_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => handleTagClick(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                tag === t
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* People filter */}
        {namedPeople.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setPeopleExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`transition-transform ${peopleExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                People
                {selectedPersonIds.size > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none">
                    {selectedPersonIds.size}
                  </span>
                )}
              </button>
              {peopleExpanded && (
                <div className="flex gap-0.5">
                  {(["popular", "alpha"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPeopleSort(s)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                        peopleSort === s ? "bg-gray-700 text-white" : "text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {s === "popular" ? "Popular" : "A–Z"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {peopleExpanded && (
              <div className="flex flex-wrap gap-1.5">
                {[...namedPeople]
                  .sort((a, b) =>
                    peopleSort === "alpha"
                      ? a.name.localeCompare(b.name)
                      : b.photoCount - a.photoCount
                  )
                  .map((p) => {
                    const selected = selectedPersonIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePersonToggle(p.id)}
                        title={`${p.name} (${p.photoCount} photos)`}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-colors ${
                          selected
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          {p.coverPhotoUrl
                            ? <img src={p.coverPhotoUrl} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gray-600" />
                          }
                        </div>
                        {p.name}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results header */}
      {searched && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="text-sm text-gray-400">
            {loading ? "Searching…" : `${total.toLocaleString()} photo${total !== 1 ? "s" : ""}`}
          </div>
          <div className="flex items-center gap-1">
            {(["grid", "list", "map"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  view === v
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {v === "grid" ? "⊞ Grid" : v === "list" ? "≡ List" : "◉ Map"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading && photos.length === 0 && (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
            Searching…
          </div>
        )}

        {!loading && view === "grid" && <PhotoGrid photos={photos} />}
        {!loading && view === "list" && <PhotoList photos={photos} />}
        {!loading && view === "map" && <MapView photos={photos} />}

        {/* Pagination */}
        {pages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8 pb-4">
            <button
              onClick={() => { const p = page - 1; setPage(p); search(query, year, tag, minRating, [...selectedPersonIds], p); }}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => { const p = page + 1; setPage(p); search(query, year, tag, minRating, [...selectedPersonIds], p); }}
              disabled={page >= pages}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

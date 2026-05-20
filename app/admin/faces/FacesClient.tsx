"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type BoundingBox = { top: number; left: number; width: number; height: number };

type PersonSummary = {
  id: string;
  name: string;
  deferred: boolean;
  coverPhotoUrl: string | null;
  photoCount: number;
  samplePhotos: { photoId: string; thumbnailUrl: string; boundingBox: BoundingBox | null }[];
};

type Filter = "all" | "unnamed" | "named";

export default function FacesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFilter = (searchParams.get("filter") as Filter) ?? "unnamed";

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMerging, setBulkMerging] = useState(false);

  const load = useCallback(async (f: Filter, query: string, pg: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ filter: f, page: String(pg) });
      if (query) params.set("q", query);
      const res = await fetch(`/api/admin/faces?${params}`);
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error ?? "Unknown error"); return; }
      setPersons(data.persons);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initialFilter, "", 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter(f: Filter) {
    setFilter(f);
    setPage(1);
    setSelected(new Set());
    setSelectMode(false);
    router.replace(`/admin/faces?filter=${f}`, { scroll: false });
    load(f, q, 1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(filter, q, 1);
  }

  function handleCardClick(person: PersonSummary) {
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(person.id) ? next.delete(person.id) : next.add(person.id);
        return next;
      });
    } else {
      router.push(`/admin/faces/${person.id}`);
    }
  }

  function removePerson(id: string) {
    setPersons((prev) => prev.filter((p) => p.id !== id));
    setTotal((prev) => prev - 1);
  }

  async function handleBulkMerge() {
    if (selected.size < 2) return;
    setBulkMerging(true);
    try {
      const selectedPersons = persons.filter((p) => selected.has(p.id));
      const target = selectedPersons.reduce((a, b) => a.photoCount >= b.photoCount ? a : b);
      const others = selectedPersons.filter((p) => p.id !== target.id);
      for (const other of others) {
        await fetch(`/api/admin/faces/${other.id}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intoId: target.id }),
        });
        removePerson(other.id);
      }
      setSelected(new Set());
      setSelectMode(false);
      // Navigate to the merged person's detail page to name it
      router.push(`/admin/faces/${target.id}`);
    } finally {
      setBulkMerging(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Back</Link>
          <span className="font-bold text-lg tracking-tight">Face Labeling</span>
        </div>
        <div className="flex items-center gap-3">
          {selectMode && selected.size >= 2 && (
            <button
              onClick={handleBulkMerge}
              disabled={bulkMerging}
              className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
            >
              {bulkMerging ? "Merging…" : `Merge ${selected.size} selected`}
            </button>
          )}
          <button
            onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              selectMode ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
          <span className="text-sm text-gray-500">{total.toLocaleString()} people</span>
        </div>
      </header>

      <div className="px-6 py-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["unnamed", "named", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors capitalize ${
                filter === f ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-52"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
            Search
          </button>
        </form>
      </div>

      <main className="px-6 py-6">
        {loading && <div className="text-center py-20 text-gray-500 text-sm">Loading…</div>}
        {loadError && <div className="text-center py-20 text-red-400 text-sm font-mono">{loadError}</div>}
        {!loading && !loadError && persons.length === 0 && (
          <div className="text-center py-20 text-gray-500 text-sm">No people found.</div>
        )}

        {!loading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {persons.map((person) => {
              const isSelected = selected.has(person.id);
              return (
                <button
                  key={person.id}
                  onClick={() => handleCardClick(person)}
                  className="flex flex-col items-center gap-2 group focus:outline-none"
                >
                  <div className={`relative w-20 h-20 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 ring-2 transition-all ${
                    isSelected ? "ring-blue-400" :
                    person.deferred ? "ring-yellow-600 opacity-60" :
                    "ring-transparent group-hover:ring-blue-500"
                  }`}>
                    {person.coverPhotoUrl ? (
                      <img src={person.coverPhotoUrl} alt={person.name || "Unnamed"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">?</div>
                    )}
                    {selectMode && (
                      <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-blue-500 border-blue-500" : "bg-black/50 border-gray-400"
                      }`}>
                        {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    )}
                    {person.deferred && !selectMode && (
                      <div className="absolute inset-0 flex items-end justify-center pb-1">
                        <span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-1.5 py-0.5 rounded-full leading-none">deferred</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-medium truncate max-w-[80px] ${!person.name ? "text-gray-500 italic" : "text-gray-200"}`}>
                      {person.name || "Unnamed"}
                    </div>
                    <div className="text-xs text-gray-600">{person.photoCount} photos</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {pages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button onClick={() => { const p = page - 1; setPage(p); load(filter, q, p); }} disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors">
              ← Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {pages}</span>
            <button onClick={() => { const p = page + 1; setPage(p); load(filter, q, p); }} disabled={page >= pages}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors">
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

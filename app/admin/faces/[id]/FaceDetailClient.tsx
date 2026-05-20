"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type BoundingBox = { top: number; left: number; width: number; height: number };

type PhotoEntry = {
  photoId: string;
  thumbnailUrl: string;
  takenAt: string | null;
  galleryTitle: string;
  confidence: number | null;
  flagged: boolean;
  boundingBox: BoundingBox | null;
};

type PersonDetail = {
  id: string;
  name: string;
  deferred: boolean;
  coverPhotoUrl: string | null;
  photoCount: number;
  photos: PhotoEntry[];
};

type PersonSummary = {
  id: string;
  name: string;
  coverPhotoUrl: string | null;
  photoCount: number;
};

type SimilarSuggestion = PersonSummary & { similarity: number };

type SuggestionPreview = {
  suggestion: SimilarSuggestion;
  photos: PhotoEntry[];
};

export default function FaceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deferring, setDeferring] = useState(false);
  const [settingCover, setSettingCover] = useState<string | null>(null);
  const [hidingPhoto, setHidingPhoto] = useState<string | null>(null);

  // Named persons for quick merge
  const [namedPersons, setNamedPersons] = useState<PersonSummary[]>([]);
  const [namedTotal, setNamedTotal] = useState(0);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSort, setMergeSort] = useState<"popular" | "alpha" | "recent">("popular");
  const [mergingId, setMergingId] = useState<string | null>(null);
  const mergeSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo last merge
  type UndoSnapshot = {
    fromPerson: { name: string; rekognitionFaceId?: string | null; coverPhotoUrl?: string | null; deferred: boolean };
    movedPhotoIds: string[];
    intoId: string;
  };
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Next person in queue + recently-named for quick-merge chips
  const [nextPersonId, setNextPersonId] = useState<string | null>(null);
  const [recentPersons, setRecentPersons] = useState<PersonSummary[]>([]);

  // Similar cluster suggestions
  const [suggestions, setSuggestions] = useState<SimilarSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/faces/${id}`);
      if (!res.ok) { router.push("/admin/faces?filter=unnamed"); return; }
      const data: PersonDetail = await res.json();
      setPerson(data);
      setNameInput(data.name);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadNamedPersons = useCallback(async (q: string, sort: "popular" | "alpha" | "recent" = "popular") => {
    const params = new URLSearchParams({ filter: "named", page: "1", sort });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/faces?${params}`);
    const data = await res.json();
    setNamedPersons(data.persons);
    setNamedTotal(data.total);
  }, []);

  useEffect(() => {
    load();
    loadNamedPersons("");
    // Prefetch next unnamed person and recently-named people for chips
    fetch(`/api/admin/faces/next?currentId=${id}`)
      .then((r) => r.json())
      .then((d) => setNextPersonId(d.nextId ?? null))
      .catch(() => {});
    fetch(`/api/admin/faces?filter=named&sort=popular&page=1`)
      .then((r) => r.json())
      .then((d) => setRecentPersons((d.persons ?? []).slice(0, 6)))
      .catch(() => {});
    setTimeout(() => nameInputRef.current?.focus(), 100);

    // Restore suggestions only if they were saved for this specific person
    const stored = sessionStorage.getItem("face-suggestions");
    if (stored) {
      try {
        const { forPersonId, suggestions: restored } = JSON.parse(stored);
        if (forPersonId === id) {
          setSuggestions(restored);
          setSuggestionsReady(true);
        } else {
          sessionStorage.removeItem("face-suggestions");
        }
      } catch {
        sessionStorage.removeItem("face-suggestions");
      }
    }

    // Restore undo snapshot if a merge was just made into this person
    const storedUndo = sessionStorage.getItem(`face-undo-${id}`);
    if (storedUndo) {
      try {
        setUndoSnapshot(JSON.parse(storedUndo));
      } catch {
        sessionStorage.removeItem(`face-undo-${id}`);
      }
    }
  }, [load, loadNamedPersons]);

  const goToNext = useCallback(() => {
    sessionStorage.removeItem("face-suggestions");
    if (nextPersonId) router.push(`/admin/faces/${nextPersonId}`);
    else router.push("/admin/faces?filter=unnamed");
  }, [nextPersonId, router]);

  // Keyboard shortcuts — only when not typing in an input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "n") goToNext();
      if (e.key === "Escape") router.push("/admin/faces?filter=unnamed");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goToNext, router]);

  function handleMergeSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setMergeSearch(q);
    if (mergeSearchTimeout.current) clearTimeout(mergeSearchTimeout.current);
    mergeSearchTimeout.current = setTimeout(() => loadNamedPersons(q, mergeSort), 250);
  }

  function handleMergeSortChange(sort: "popular" | "alpha" | "recent") {
    setMergeSort(sort);
    loadNamedPersons(mergeSearch, sort);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/faces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      goToNext();
    } finally {
      setSaving(false);
    }
  }


  async function handleSplit(photoId: string) {
    const res = await fetch(`/api/admin/faces/${id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (!res.ok) return;
    // Remove from local state — it now belongs to a new unnamed person
    setPerson((prev) =>
      prev
        ? { ...prev, photoCount: prev.photoCount - 1, photos: prev.photos.filter((p) => p.photoId !== photoId) }
        : prev
    );
  }

  async function handleFindSimilar() {
    setLoadingSuggestions(true);
    setSuggestionsError("");
    setSuggestions(null);
    setSuggestionsReady(false);
    setPreview(null);
    sessionStorage.removeItem("face-suggestions");
    try {
      const res = await fetch(`/api/admin/faces/${id}/similar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSuggestionsError(data.error ?? "Search failed");
        return;
      }
      setSuggestions(data.suggestions);
      // Brief delay before enabling clicks to prevent accidental merges
      // from a click-through on the results that just appeared
      setTimeout(() => setSuggestionsReady(true), 600);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleSelectSuggestion(s: SimilarSuggestion) {
    setPreview(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/admin/faces/${s.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setPreview({ suggestion: s, photos: data.photos });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleMerge(intoId: string, stayOnPage = false) {
    setMergingId(intoId);
    try {
      const res = await fetch(`/api/admin/faces/${id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intoId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Save undo snapshot keyed to the merge target so it shows when visiting that person
      if (stayOnPage) {
        // Store undo keyed to where we're navigating (the merge target)
        if (data.undo) {
          sessionStorage.setItem(`face-undo-${data.mergedIntoId}`, JSON.stringify(data.undo));
        }
        // Persist remaining suggestions tagged to the destination person ID
        const remaining = (suggestions ?? []).filter((s) => s.id !== intoId);
        if (remaining.length > 0) {
          sessionStorage.setItem("face-suggestions", JSON.stringify({ forPersonId: data.mergedIntoId, suggestions: remaining }));
        } else {
          sessionStorage.removeItem("face-suggestions");
        }
        router.push(`/admin/faces/${data.mergedIntoId}`);
      } else {
        // Store undo keyed to wherever goToNext() will land
        if (data.undo && nextPersonId) {
          sessionStorage.setItem(`face-undo-${nextPersonId}`, JSON.stringify(data.undo));
        }
        sessionStorage.removeItem("face-suggestions");
        goToNext();
      }
    } finally {
      setMergingId(null);
    }
  }

  async function handleUndo() {
    if (!undoSnapshot) return;
    setUndoing(true);
    try {
      const res = await fetch(`/api/admin/faces/${undoSnapshot.intoId}/unmerge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPerson: undoSnapshot.fromPerson,
          movedPhotoIds: undoSnapshot.movedPhotoIds,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      sessionStorage.removeItem(`face-undo-${id}`);
      setUndoSnapshot(null);
      router.push(`/admin/faces/${data.restoredPersonId}`);
    } finally {
      setUndoing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${person?.name || "Unnamed"}" and all ${person?.photoCount} face links? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/faces/${id}`, { method: "DELETE" });
      goToNext();
    } finally {
      setDeleting(false);
    }
  }

  async function handleHidePhoto(photoId: string) {
    setHidingPhoto(photoId);
    try {
      const res = await fetch(`/api/photos/${photoId}/hide`, { method: "POST" });
      if (!res.ok) return;
      setPerson((prev) =>
        prev ? { ...prev, photoCount: prev.photoCount - 1, photos: prev.photos.filter((p) => p.photoId !== photoId) } : prev
      );
    } finally {
      setHidingPhoto(null);
    }
  }

  async function handleDefer() {
    setDeferring(true);
    try {
      const res = await fetch(`/api/admin/faces/${id}/defer`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.deferred) {
        // Deferred — advance to next unnamed person
        goToNext();
      } else {
        // Un-deferred — update local state
        setPerson((prev) => prev ? { ...prev, deferred: false } : prev);
      }
    } finally {
      setDeferring(false);
    }
  }

  async function handleSetCover(thumbnailUrl: string) {
    setSettingCover(thumbnailUrl);
    try {
      const res = await fetch(`/api/admin/faces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPhotoUrl: thumbnailUrl }),
      });
      if (!res.ok) return;
      setPerson((prev) => prev ? { ...prev, coverPhotoUrl: thumbnailUrl } : prev);
    } finally {
      setSettingCover(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading…</span>
      </div>
    );
  }

  if (!person) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin/faces?filter=unnamed" className="text-gray-400 hover:text-white text-sm">← Faces</Link>
        <span className="font-bold text-lg tracking-tight">
          {person.name ? person.name : <span className="text-gray-500 italic">Unnamed</span>}
        </span>
        <span className="text-sm text-gray-500">{person.photoCount} photos</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={goToNext}
            className="text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 hover:text-white"
          >
            {nextPersonId ? "Next →" : "Done ✓"}
          </button>
        </div>
      </header>

      {undoSnapshot && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/50 px-6 py-2 flex items-center gap-3 text-sm">
          <span className="text-yellow-300">
            Merged <span className="font-medium">{undoSnapshot.fromPerson.name || "Unnamed"}</span> into this person
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="text-xs bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors"
            >
              {undoing ? "Undoing…" : "Undo merge"}
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(`face-undo-${id}`); setUndoSnapshot(null); }}
              className="text-yellow-600 hover:text-yellow-400 text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-gray-800 overflow-y-auto p-5 space-y-6">
          {/* Name */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Name</div>
            <form onSubmit={handleRename} className="flex flex-col gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter name…"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={saving || !nameInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save name"}
              </button>
            </form>
          </div>

          {/* Quick-merge chips — recently named people */}
          {recentPersons.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick merge</div>
              <div className="flex flex-col gap-1">
                {recentPersons.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleMerge(p.id)}
                    disabled={mergingId !== null}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-40 transition-colors text-left group"
                    title={`Merge into ${p.name}`}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                      {p.coverPhotoUrl
                        ? <img src={p.coverPhotoUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">?</div>
                      }
                    </div>
                    <span className="text-xs text-gray-300 group-hover:text-white truncate">{p.name}</span>
                    {mergingId === p.id && <span className="text-xs text-gray-500 ml-auto">…</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Avatar */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Avatar</div>
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 ring-2 ring-gray-700">
              {person.coverPhotoUrl ? (
                <img src={person.coverPhotoUrl} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">?</div>
              )}
            </div>
            {!person.coverPhotoUrl && (
              <p className="text-xs text-gray-600 mt-1.5">Hover a photo to set one</p>
            )}
          </div>

          {/* Person ID */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Person ID</div>
            <code className="text-xs text-gray-600 break-all">{person.id}</code>
          </div>

          {/* Defer / Un-defer */}
          <div className="pt-2 border-t border-gray-800">
            <button
              onClick={handleDefer}
              disabled={deferring}
              className={`w-full text-xs disabled:opacity-40 py-2 transition-colors ${
                person.deferred
                  ? "text-yellow-400 hover:text-yellow-300"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {deferring ? "…" : person.deferred ? "Un-defer (move to front)" : "Defer (skip for now)"}
            </button>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-800">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-xs text-red-500 hover:text-red-400 disabled:opacity-40 py-2 transition-colors"
            >
              {deleting ? "Deleting…" : "Delete this person"}
            </button>
          </div>
        </aside>

        {/* Main: photos + merge section */}
        <main className="flex-1 overflow-y-auto">
          {/* This person's photos */}
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {person.photos.map((photo) => (
                <div key={photo.photoId} className="relative group aspect-square">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.galleryTitle}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                    title={`${photo.galleryTitle}${photo.takenAt ? " · " + new Date(photo.takenAt).toLocaleDateString() : ""}${photo.confidence ? " · " + Math.round(photo.confidence) + "%" : ""}`}
                  />
                  {/* Bounding box highlight */}
                  {photo.boundingBox && (
                    <div
                      className="absolute pointer-events-none rounded-sm ring-2 ring-blue-400"
                      style={{
                        top: `${photo.boundingBox.top * 100}%`,
                        left: `${photo.boundingBox.left * 100}%`,
                        width: `${photo.boundingBox.width * 100}%`,
                        height: `${photo.boundingBox.height * 100}%`,
                      }}
                    />
                  )}
                  {/* Current avatar indicator */}
                  {person.coverPhotoUrl === photo.thumbnailUrl && (
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center" title="Current avatar">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4" stroke="white" strokeWidth="1.5"/>
                        <circle cx="5" cy="5" r="2" fill="white"/>
                      </svg>
                    </div>
                  )}
                  {/* Set as avatar button */}
                  {person.coverPhotoUrl !== photo.thumbnailUrl && (
                    <button
                      onClick={() => handleSetCover(photo.thumbnailUrl)}
                      disabled={settingCover !== null}
                      className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition-all disabled:opacity-40"
                      title="Set as avatar"
                    >
                      {settingCover === photo.thumbnailUrl ? "…" : "Avatar"}
                    </button>
                  )}
                  {/* Split button */}
                  <button
                    onClick={() => handleSplit(photo.photoId)}
                    className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition-all"
                    title="Split into new person"
                  >
                    Split
                  </button>
                  {/* Hide button */}
                  <button
                    onClick={() => handleHidePhoto(photo.photoId)}
                    disabled={hidingPhoto === photo.photoId}
                    className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 hover:text-red-200 transition-all disabled:opacity-40"
                    title="Hide photo"
                  >
                    {hidingPhoto === photo.photoId ? "…" : "Hide"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Similar clusters */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Similar clusters</div>
              <button
                onClick={handleFindSimilar}
                disabled={loadingSuggestions || mergingId !== null}
                className="text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-1 rounded-full transition-colors"
              >
                {loadingSuggestions ? "Searching…" : suggestions === null ? "Find similar" : "Search again"}
              </button>
            </div>

            {suggestionsError && (
              <p className="text-xs text-red-400 mb-2">{suggestionsError}</p>
            )}

            {suggestions !== null && suggestions.length === 0 && (
              <p className="text-xs text-gray-600">No similar clusters found above 75% confidence.</p>
            )}

            {suggestions !== null && suggestions.length > 0 && (
              <div className="space-y-4">
                {/* Bubble row */}
                <div className="flex flex-wrap gap-4">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSuggestion(s)}
                      disabled={!suggestionsReady || loadingPreview || mergingId !== null}
                      className={`flex flex-col items-center gap-1.5 group disabled:opacity-50 transition-opacity ${
                        preview?.suggestion.id === s.id ? "opacity-100" : ""
                      }`}
                      title={`Preview ${s.name || "Unnamed"} (${s.photoCount} photos, ${s.similarity}% match)`}
                    >
                      <div className={`w-16 h-16 rounded-full overflow-hidden bg-gray-800 ring-2 transition-all ${
                        preview?.suggestion.id === s.id
                          ? "ring-blue-500"
                          : "ring-transparent group-hover:ring-blue-400"
                      }`}>
                        {s.coverPhotoUrl ? (
                          <img src={s.coverPhotoUrl} alt={s.name || "Unnamed"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">?</div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 text-center leading-tight w-16 break-words">
                        {s.name || "Unnamed"}
                      </span>
                      <span className="text-xs text-blue-500 font-medium">{s.similarity}%</span>
                    </button>
                  ))}
                </div>

                {/* Preview panel */}
                {loadingPreview && (
                  <div className="text-xs text-gray-500 py-2">Loading photos…</div>
                )}
                {preview && (
                  <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        <span className="text-white font-medium">{preview.suggestion.name || "Unnamed"}</span>
                        <span className="ml-2 text-gray-600">· {preview.suggestion.photoCount} photos · {preview.suggestion.similarity}% match</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMerge(preview.suggestion.id, true)}
                          disabled={mergingId !== null}
                          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          {mergingId ? "Merging…" : "Merge together"}
                        </button>
                        <button
                          onClick={() => setPreview(null)}
                          className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Not the same
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                      {preview.photos.map((photo) => (
                        <div key={photo.photoId} className="relative aspect-square">
                          <img
                            src={photo.thumbnailUrl}
                            alt={photo.galleryTitle}
                            className="w-full h-full object-cover rounded"
                            loading="lazy"
                            title={photo.galleryTitle}
                          />
                          {photo.boundingBox && (
                            <div
                              className="absolute pointer-events-none rounded-sm ring-2 ring-blue-400"
                              style={{
                                top: `${photo.boundingBox.top * 100}%`,
                                left: `${photo.boundingBox.left * 100}%`,
                                width: `${photo.boundingBox.width * 100}%`,
                                height: `${photo.boundingBox.height * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Merge with named person */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                Merge with existing person
                {namedTotal > 0 && <span className="ml-2 text-gray-600 normal-case">({namedTotal} named)</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {(["popular", "alpha", "recent"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleMergeSortChange(s)}
                      className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                        mergeSort === s
                          ? "bg-gray-700 text-white"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {s === "popular" ? "Popular" : s === "alpha" ? "A–Z" : "Recent"}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={mergeSearch}
                  onChange={handleMergeSearchChange}
                  placeholder="Filter by name…"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-36"
                />
              </div>
            </div>

            {namedPersons.length === 0 ? (
              <div className="text-xs text-gray-600 py-4">
                {mergeSearch ? "No matches." : "No named people yet — name someone first."}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {namedPersons.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleMerge(p.id)}
                    disabled={mergingId !== null}
                    className="flex flex-col items-center gap-1.5 group disabled:opacity-50"
                    title={`Merge into ${p.name} (${p.photoCount} photos)`}
                  >
                    <div className={`w-16 h-16 rounded-full overflow-hidden bg-gray-800 ring-2 transition-all ${
                      mergingId === p.id
                        ? "ring-yellow-500"
                        : "ring-transparent group-hover:ring-blue-500"
                    }`}>
                      {p.coverPhotoUrl ? (
                        <img src={p.coverPhotoUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">?</div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 text-center leading-tight w-full px-1 break-words">
                      {mergingId === p.id ? "…" : p.name}
                    </span>
                    <span className="text-xs text-gray-600">{p.photoCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Keyboard shortcut reference */}
      <div className="border-t border-gray-800/60 px-6 py-2 flex items-center gap-6 text-xs text-gray-700">
        <span>Keyboard shortcuts:</span>
        <span><kbd className="font-mono bg-gray-800 px-1 rounded">n</kbd> or <kbd className="font-mono bg-gray-800 px-1 rounded">→</kbd> next person</span>
        <span><kbd className="font-mono bg-gray-800 px-1 rounded">Esc</kbd> back to list</span>
      </div>
    </div>
  );
}

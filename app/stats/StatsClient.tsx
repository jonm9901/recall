"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatsData {
  overview: {
    totalPhotos: number;
    indexedPhotos: number;
    gpsPhotos: number;
    totalGalleries: number;
    totalPersons: number;
    namedPersons: number;
    totalFaceLinks: number;
    totalTags: number;
    ratedPhotos: number;
  };
  topTags: { tag: string; count: number }[];
  photosByYear: { year: number; count: number }[];
  topLocations: { label: string; count: number }[];
  topPeople: { name: string; count: number }[];
  ratingDist: { stars: number; count: number }[];
  topGalleries: { title: string; count: number }[];
  tagSources: { source: string; count: number }[];
}

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

const STAR_COLORS = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-blue-400"];

export default function StatsClient() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load stats"));
  }, []);

  const logoSvg = (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 14C2 14 7 5 14 5C21 5 26 14 26 14C26 14 21 23 14 23C7 23 2 14 2 14Z"
        fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="14" cy="14" r="5.5" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1"/>
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
      <circle cx="14" cy="14" r="2" fill="#bfdbfe"/>
      <circle cx="15.5" cy="12.5" r="0.7" fill="white" opacity="0.8"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {logoSvg}
          <span className="font-bold text-lg tracking-tight">Total Recall</span>
        </Link>
        <div className="flex items-center gap-4">
          <a href="/stats" className="text-sm text-white font-medium">Stats</a>
          <a href="/admin/sync" className="text-sm text-gray-400 hover:text-white transition-colors">Sync</a>
          <a href="/admin/index" className="text-sm text-gray-400 hover:text-white transition-colors">Index</a>
          <a href="/admin/faces" className="text-sm text-gray-400 hover:text-white transition-colors">Faces</a>
          <a href="/settings/users" className="text-sm text-gray-400 hover:text-white transition-colors">Settings</a>
          <a href="/api/auth/signout" className="text-sm text-gray-400 hover:text-white transition-colors">Sign out</a>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-6">Library Stats</h1>

        {error && <div className="text-red-400 mb-6">{error}</div>}

        {!data && !error && (
          <div className="text-gray-500 animate-pulse">Loading…</div>
        )}

        {data && (() => {
          const ov = data.overview;
          const maxTag = data.topTags[0]?.count ?? 1;
          const maxYear = Math.max(...data.photosByYear.map((r) => r.count), 1);
          const maxLoc = data.topLocations[0]?.count ?? 1;
          const maxPerson = data.topPeople[0]?.count ?? 1;
          const maxGallery = data.topGalleries[0]?.count ?? 1;
          const totalRatings = data.ratingDist.reduce((s, r) => s + r.count, 0) || 1;

          return (
            <div className="space-y-6">
              {/* Overview cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard label="Total photos" value={ov.totalPhotos} />
                <StatCard
                  label="Indexed"
                  value={ov.indexedPhotos}
                  sub={`${Math.round((ov.indexedPhotos / ov.totalPhotos) * 100)}% of library`}
                />
                <StatCard label="Galleries" value={ov.totalGalleries} />
                <StatCard
                  label="Faces identified"
                  value={ov.totalFaceLinks}
                  sub={`${ov.namedPersons} named · ${ov.totalPersons - ov.namedPersons} unnamed`}
                />
                <StatCard label="Tags applied" value={ov.totalTags} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="With GPS" value={ov.gpsPhotos} sub={`${Math.round((ov.gpsPhotos / ov.totalPhotos) * 100)}% of library`} />
                <StatCard label="Rated photos" value={ov.ratedPhotos} sub={`${Math.round((ov.ratedPhotos / ov.totalPhotos) * 100)}% of library`} />
                <StatCard label="Unique people" value={ov.totalPersons} />
                <StatCard label="Named people" value={ov.namedPersons} sub={`${ov.totalPersons - ov.namedPersons} still unnamed`} />
              </div>

              {/* Photos by year */}
              <Section title="Photos by year">
                <div className="space-y-1.5">
                  {data.photosByYear.map((r) => (
                    <div key={r.year} className="flex items-center gap-3 text-sm">
                      <span className="w-10 text-right text-gray-400 font-mono">{r.year}</span>
                      <Bar value={r.count} max={maxYear} color="bg-blue-500" />
                      <span className="w-14 text-right text-gray-300 font-mono">{r.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top tags */}
                <Section title="Top tags">
                  <div className="space-y-1.5">
                    {data.topTags.map((r) => (
                      <div key={r.tag} className="flex items-center gap-3 text-sm">
                        <span className="w-32 truncate text-gray-300">{r.tag}</span>
                        <Bar value={r.count} max={maxTag} color="bg-violet-500" />
                        <span className="w-12 text-right text-gray-400 font-mono">{r.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Top people */}
                <Section title="Most photographed people">
                  {data.topPeople.length === 0 ? (
                    <p className="text-gray-600 text-sm">No named people yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.topPeople.map((r) => (
                        <div key={r.name} className="flex items-center gap-3 text-sm">
                          <span className="w-32 truncate text-gray-300">{r.name}</span>
                          <Bar value={r.count} max={maxPerson} color="bg-pink-500" />
                          <span className="w-12 text-right text-gray-400 font-mono">{r.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top locations */}
                <Section title="Top locations">
                  {data.topLocations.length === 0 ? (
                    <p className="text-gray-600 text-sm">No location data yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.topLocations.map((r) => (
                        <div key={r.label} className="flex items-center gap-3 text-sm">
                          <span className="w-36 truncate text-gray-300">{r.label}</span>
                          <Bar value={r.count} max={maxLoc} color="bg-emerald-500" />
                          <span className="w-12 text-right text-gray-400 font-mono">{r.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Rating distribution */}
                <Section title="Rating distribution">
                  {data.ratingDist.length === 0 ? (
                    <p className="text-gray-600 text-sm">No ratings yet</p>
                  ) : (
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const row = data.ratingDist.find((r) => r.stars === stars);
                        const count = row?.count ?? 0;
                        return (
                          <div key={stars} className="flex items-center gap-3 text-sm">
                            <span className="text-yellow-400 w-20 shrink-0">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
                            <Bar value={count} max={totalRatings} color={STAR_COLORS[stars]} />
                            <span className="w-12 text-right text-gray-400 font-mono">{count.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top galleries */}
                <Section title="Largest galleries">
                  <div className="space-y-1.5">
                    {data.topGalleries.map((r) => (
                      <div key={r.title} className="flex items-center gap-3 text-sm">
                        <span className="w-44 truncate text-gray-300" title={r.title}>{r.title}</span>
                        <Bar value={r.count} max={maxGallery} color="bg-amber-500" />
                        <span className="w-12 text-right text-gray-400 font-mono">{r.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Tag sources */}
                <Section title="Tag sources">
                  <div className="space-y-2">
                    {data.tagSources.map((r) => {
                      const maxSrc = data.tagSources[0]?.count ?? 1;
                      return (
                        <div key={r.source} className="flex items-center gap-3 text-sm">
                          <span className="w-28 truncate text-gray-300 capitalize">{r.source}</span>
                          <Bar value={r.count} max={maxSrc} color="bg-cyan-500" />
                          <span className="w-14 text-right text-gray-400 font-mono">{r.count.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

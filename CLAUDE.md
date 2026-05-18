# Recall — Personal Photo Intelligence Layer

## Stack
- Next.js 14 (App Router, TypeScript, Tailwind CSS)
- Prisma ORM v7 + Neon PostgreSQL
- NextAuth.js v5 beta (credentials provider)
- AWS Rekognition (face detection + scene tagging)
- Vercel (hosting)
- react-leaflet (map view)

## Project structure
```
app/              Next.js App Router pages and layouts
app/api/          API routes
components/       Shared React components
lib/              Utility modules (smugmug.ts, rekognition.ts, geocode.ts)
prisma/           Schema and migrations
prisma.config.ts  Prisma v7 config (loads .env.local for DATABASE_URL)
scripts/          Standalone pipeline scripts (smugmug-sync.ts, index-photos.ts)
docs/             Requirements and build plan documents
```

## Running locally
```bash
cp .env.example .env.local   # fill in all env vars
npx prisma db push           # sync schema to Neon
npm run dev                  # start dev server on localhost:3000
npx ts-node scripts/smugmug-sync.ts    # sync galleries from SmugMug
npx ts-node scripts/index-photos.ts   # run Rekognition indexing pipeline
```

## Prisma notes
Prisma v7 moves datasource URL out of schema.prisma and into prisma.config.ts.
The config file loads .env.local (Next.js convention) via dotenv before falling back to .env.

## Environment variables

### Phase 1
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |

### Phase 2
| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Random 32-char string for session signing |
| `NEXTAUTH_URL` | Full URL of deployed app |
| `INVITE_EXPIRY_DAYS` | Days before invite link expires (default: 7) |
| `MAX_USERS` | Soft cap on total users (default: 5) |

### Phase 3
| Variable | Description |
|----------|-------------|
| `SMUGMUG_API_KEY` | SmugMug OAuth consumer key |
| `SMUGMUG_API_SECRET` | SmugMug OAuth consumer secret |
| `SMUGMUG_ACCESS_TOKEN` | SmugMug OAuth access token |
| `SMUGMUG_ACCESS_SECRET` | SmugMug OAuth access token secret |
| `SMUGMUG_SITE_PASSWORD` | Site-level password for SmugMug CDN cookie auth |
| `SMUGMUG_ALBUM_BASE_URL` | Base URL of SmugMug site e.g. https://yourname.smugmug.com |

### Phase 4
| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region for Rekognition e.g. us-east-1 |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key with Rekognition permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `REKOGNITION_COLLECTION_ID` | Name of the Rekognition face collection (e.g. recall-faces) |
| `GEOCODING_API_KEY` | Google Maps Geocoding API key |

### Phase 7
| Variable | Description |
|----------|-------------|
| `AI_RATING_API_KEY` | Anthropic API key for photo rating |
| `AI_RATING_MODEL` | Model string e.g. claude-sonnet-4-6 |

## Build phases
| Phase | Title | Scope |
|-------|-------|-------|
| 1 | Scaffold & Config | Next.js app, Prisma schema, Neon DB, Vercel deploy |
| 2 | Auth | NextAuth credentials login, invite flow, user management page |
| 3 | SmugMug Integration | OAuth connection, site password cookie, gallery + photo sync |
| 4 | Indexing Pipeline | AWS Rekognition faces + scene tags, reverse geocoding, resync |
| 5 | Search & Results UI | Search bar, filters, photo grid, list view, map view |
| 6 | Face Labeling | Cluster review, name assignment, flag mismatches, merge |
| 7 | Star Ratings | Inline rating, AI suggestions, average display, rating filter |
| 8 | Claude Vision Tagging | Haiku vision pass: contextual tags + captions for all photos |

## Current phase
Phase 7 complete — ready for Phase 8 (Claude Vision Tagging)

## Completed phases
- Phase 1 — Scaffold & Config
- Phase 2 — Auth
- Phase 3 — SmugMug Integration (675 galleries, 39,717 photos synced; 1 excluded)
- Phase 4 — Indexing Pipeline (39,717 photos indexed; 468,596 tags; 28,285 face links)
- Phase 5 — Search & Results UI (+ forward geocoding pass: 22 photos updated via Nominatim)
- Phase 6 — Face Labeling (cluster grid, name assignment, bounding box overlay, one-click merge)
- Phase 7 — Star Ratings (inline 5-star widget, AI suggestion via Claude Haiku, avgRating filter in search)

## Phase 4 notes
- Rekognition collection: `recall-faces` (us-west-2)
- Pipeline: DetectLabels (scene tags ≥70% confidence) + IndexFaces + SearchFaces (85% threshold for clustering) + Nominatim reverse geocoding
- Script: `npx ts-node --project tsconfig.scripts.json scripts/index-photos.ts`
- Admin UI: /admin/index — shows progress, faces, tags, geocoded count
- ~500ms per photo; ~39,700 photos → ~5-6 hour full run
- Re-runnable: skips photos where indexedAt is not null
- Geocoding uses Nominatim (free, no key) — rate limited to 1 req/sec

## Phase 5 requirements / notes
- Add forward geocoding pass: photos with `locationName` (from gallery title) but no `city` should be geocoded via Nominatim lookup of the location string → fill in `city`, `region`, `country`. Most photos were taken on an SLR with no GPS, so gallery-title location is the primary source of structured location data.

## Phase 8 requirements / notes
- Model: `claude-haiku-4-5-20251001` (~$75–100 one-time for 39,700 photos)
- Uses existing `AI_RATING_API_KEY`; set `AI_RATING_MODEL=claude-haiku-4-5-20251001`
- Schema additions: `Photo.caption` (String?), `Photo.visionTaggedAt` (DateTime?)
- New `PhotoTag` rows with `source = "claude_vision"`
- Tags to extract: occasion (birthday, wedding, graduation…), activity (hiking, skiing…), season, setting, specific subjects Rekognition misses
- Pass existing Rekognition tags as context so Claude focuses on what's missing
- Script: `scripts/vision-tag-photos.ts` — batch 10, 500ms delay, skips `visionTaggedAt IS NOT NULL`
- Admin trigger: "Vision Tag" button on `/admin/index`
- Search: add `caption` to the OR clause in `/api/search`

## Next.js 16 notes
- Use `proxy.ts` instead of `middleware.ts` (renamed in Next.js 16; middleware.ts shows deprecation warning)
- Vercel deployment: use `vercel build --yes --prod && vercel deploy --prebuilt --prod` (auto-detection doesn't work without this)

## Known issues / deferred items
- Google Maps Geocoding API key not needed — using Nominatim (free)

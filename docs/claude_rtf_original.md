{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww16120\viewh13320\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Recall \'97 Personal Photo Intelligence Layer\
\
## Stack\
- Next.js 14 (App Router, TypeScript, Tailwind CSS)\
- Prisma ORM + Neon PostgreSQL\
- NextAuth.js v5 (credentials provider)\
- AWS Rekognition (face detection + scene tagging)\
- Vercel (hosting)\
- react-leaflet (map view)\
\
## Project structure\
app/              Next.js App Router pages and layouts\
app/api/          API routes\
components/       Shared React components\
lib/              Utility modules (smugmug.ts, rekognition.ts, geocode.ts)\
prisma/           Schema and migrations\
scripts/          Standalone pipeline scripts (smugmug-sync.ts, index-photos.ts)\
\
## Running locally\
cp .env.example .env.local   # fill in all env vars\
npx prisma db push           # sync schema\
npm run dev                  # start dev server\
npx ts-node scripts/smugmug-sync.ts    # sync galleries\
npx ts-node scripts/index-photos.ts   # run indexing pipeline\
\
## Environment variables\
DATABASE_URL                 Neon PostgreSQL connection string\
NEXTAUTH_SECRET              Random 32-char string for session signing\
NEXTAUTH_URL                 Full URL of deployed app e.g. https://recall.yourdomain.com\
INVITE_EXPIRY_DAYS           Days before invite link expires (default: 7)\
MAX_USERS                    Soft cap on total users (default: 5)\
SMUGMUG_API_KEY              SmugMug OAuth consumer key\
SMUGMUG_API_SECRET           SmugMug OAuth consumer secret\
SMUGMUG_ACCESS_TOKEN         SmugMug OAuth access token\
SMUGMUG_ACCESS_SECRET        SmugMug OAuth access token secret\
SMUGMUG_SITE_PASSWORD        Site-level password for SmugMug CDN cookie auth\
SMUGMUG_ALBUM_BASE_URL       Base URL of SmugMug site e.g. https://yourname.smugmug.com\
AWS_REGION                   AWS region for Rekognition e.g. us-east-1\
AWS_ACCESS_KEY_ID            AWS IAM access key with Rekognition permissions\
AWS_SECRET_ACCESS_KEY        AWS IAM secret key\
REKOGNITION_COLLECTION_ID    Name of the Rekognition face collection (e.g. recall-faces)\
GEOCODING_API_KEY            Google Maps Geocoding API key (leave blank for Nominatim)\
AI_RATING_API_KEY            Anthropic or OpenAI API key for photo rating (Phase 7)\
AI_RATING_MODEL              Model string e.g. claude-sonnet-4-6 or gpt-4o (Phase 7)\
\
## Build phases\
1. Scaffold & Config    \'97 Next.js app, Prisma schema, Neon DB, Vercel deploy, this file\
2. Auth                 \'97 NextAuth credentials login, invite flow, user management page\
3. SmugMug Integration  \'97 OAuth connection, site password cookie, gallery + photo sync\
4. Indexing Pipeline    \'97 AWS Rekognition faces + scene tags, reverse geocoding, resync\
5. Search & Results UI  \'97 Search bar, filters, photo grid, list view, map view\
6. Face Labeling        \'97 Cluster review, name assignment, flag mismatches, merge\
7. Star Ratings         \'97 Inline rating, AI suggestions, average display, rating filter\
\
## Current phase\
Phase 1 \'97 Scaffold & Config\
\
## Completed phases\
None\
\
## Known issues / deferred items\
None}
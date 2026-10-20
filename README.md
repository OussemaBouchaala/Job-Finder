# Job Search (PFE internship tracker)

Personal tracker for paid AI PFE internships: jobs dashboard, drag-and-drop board, job detail with AI match score and generated cover letters / emails / tailored CVs, and a profile page with the base CV.

Live: https://oussema-job-search.netlify.app (Netlify team login + Supabase sign-in).

## Stack
- Vite + React 19 + TanStack Router + Tailwind v4 (`src/`)
- Supabase for auth and data (`src/lib/supabase.ts`, publishable key only; RLS allows authenticated users only)
- Netlify Function `netlify/functions/ai.mts` at `/api/ai` using the Netlify AI Gateway (no API key needed). Actions: `score`, `generate` (`cover_letter` | `email` | `cv`).

## Setup
```bash
npm install
npm run dev        # frontend only
npx netlify dev    # frontend + /api/ai function
npm run build      # typecheck + build to dist/
```

## Database
Run `supabase/schema.sql` in the Supabase SQL editor to create the tables (hosts, sync_log, profile, match_scores, application_docs), the `updated_at` trigger and RLS policies. No data is stored in this repo.

## Deploy
Netlify builds from this repo: build `npm run build`, publish `dist`, functions `netlify/functions` (see `netlify.toml`).

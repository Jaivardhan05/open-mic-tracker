# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
npm install

# Start both web (port 3000) and API (port 8080) in parallel
npm run dev

# Build all apps
npm run build

# Typecheck all apps (Next.js typegen + tsc --noEmit)
npm run check-types

# Lint all apps
npm run lint

# Format all files
npm run format

# Run only web or only API
cd apps/web && npm run dev
cd apps/api && npm run dev   # uses tsx watch
```

There are no tests configured in this repo yet.

## Architecture

This is a **Turborepo npm workspace monorepo** with two apps and three shared packages:

```
apps/api/     – Express 4 backend (Node + TypeScript, tsx watch in dev)
apps/web/     – Next.js 16 App Router frontend (React 19, Tailwind 4)
packages/
  types/      – Shared TypeScript interfaces (Venue, Show) consumed by both apps
  ui/         – Shared React UI primitives
  eslint-config/ / typescript-config/ – Shared tooling configs
```

### API (`apps/api`)

Entry point is `src/index.ts`. Routes are defined inline there (not in a separate router directory). Key areas:

- `src/lib/supabase.ts` – Exports `supabase` (anon client) and `supabaseAdmin` (service-role client)
- `src/services/llmService.ts` – OpenAI SDK pointed at Hugging Face Router (`HF_API_TOKEN`); handles `/api/chat` RAG-style queries over venue/show data
- `src/db/` – SQL files applied manually to Supabase: `schema.sql` → `functions.sql` → `rls.sql` → `seed.sql`

### Web (`apps/web`)

Uses the Next.js **App Router**. Routes live in `app/`:

| Route | Role |
|---|---|
| `app/page.tsx` | Login / landing |
| `app/home/` | Authenticated feed |
| `app/venues/` | Venue listings |
| `app/venue-dashboard/` | Venue producer dashboard |
| `app/admin-dashboard/` | Admin panel |
| `app/profile/` | Comedian profile |
| `app/support/` | Support page |
| `app/auth/` | Auth callback |

Shared client-side code lives in `src/`:

- `src/context/AuthContext.tsx` – React context wrapping `AuthProvider`; exposes `useAuth()` hook
- `src/lib/auth.ts` – Auth helpers; user session stored in **localStorage** under key `openmic_user`
- `src/lib/supabaseClient.ts` – Browser Supabase client (uses `NEXT_PUBLIC_*` env vars)
- `src/components/` – `Navbar`, `Sidebar`, `ChatInput`, `VenueCard`, `VenueDetailSheet`, `BrandMark`

### Auth model

`AuthUser` has a `role` field: `"comedian" | "venue_producer" | "admin"`. Session is persisted in localStorage; `AuthContext` hydrates from it on mount. Supabase Auth is used for actual sign-in; the local `AuthUser` object is a mirror stored via `setCurrentUser()`.

### Styling

Tailwind CSS v4 with PostCSS. Four Google Fonts are loaded as CSS variables in `app/layout.tsx`: `--font-inter`, `--font-playfair`, `--font-bebas`, `--font-cormorant`. Global styles in `app/globals.css`.

## Environment Variables

`.env` for `apps/api`, `.env.local` for `apps/web`.

| Variable | App | Purpose |
|---|---|---|
| `SUPABASE_URL` | api | Supabase project URL |
| `SUPABASE_ANON_KEY` | api | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | api | Admin/privileged operations |
| `HF_API_TOKEN` | api | Hugging Face Router token for LLM chat |
| `PORT` | api | API port (default 8080) |
| `CORS_ORIGIN` | api | Additional allowed frontend origin |
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase URL for browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase anon key for browser client |
| `NEXT_PUBLIC_API_URL` | web | API base URL (default `http://localhost:8080`) |

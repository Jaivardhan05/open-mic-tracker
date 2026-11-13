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
  types/      – Shared TypeScript interfaces consumed by both apps, plus two runtime exports (see below)
  ui/         – Shared React UI primitives
  eslint-config/ / typescript-config/ – Shared tooling configs
```

### Shared types (`packages/types`)

Mostly types, but it has **two runtime exports** and is `"type": "module"` (the API runs as ESM under `tsx`): `deriveDisplayStatus` (the venue display-status rule, **must stay defined in `index.ts`**; a re-export from a sibling file crashes the API at startup) and `photoHosts.js` (+ `.d.ts`; the photo URL host allowlist and validator, imported by deep path `@repo/types/photoHosts.js` because the package has no `exports` map; it also feeds `next/image` `remotePatterns` in `apps/web/next.config.js`, which has `transpilePackages: ['@repo/types']`). `next build` passing does not prove the API still starts, so after any change here also start the API and hit `/api/health`. Do not add runtime exports casually.

### API (`apps/api`)

Entry point is `src/index.ts`. Routes are defined inline there (not in a separate router directory). Key areas:

- `src/lib/supabase.ts` – Exports `supabase` (anon client) and `supabaseAdmin` (service-role client)
- `src/db/` – base SQL applied manually to Supabase: `schema.sql` → `functions.sql` → `rls.sql` → `seed.sql`. These base files are **not** kept in sync with later changes: the live schema is those files plus every file in `src/db/migrations/` (`001`…`030`, including `029b`, run in order by hand in the Supabase SQL editor; SQL cannot run locally, so a migration is unrun until the user applies it).
- Admin routes live below `app.use('/api/admin', requireUser, requireRole('admin'))` (default-deny). Put new admin routes under it. Venue state changes go through `SECURITY DEFINER` RPCs called with `supabaseAdmin`; **every new function must `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and `GRANT` to `service_role`** (new functions are executable by everyone by default).
- `apps/api` has no tsconfig, so `npm run check-types` skips it. Typecheck ad hoc: `cd apps/api && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck src/index.ts` (expect the 13 old errors only). Its `build` script does not produce a working `dist`, so only dev (`tsx`) is supported; a production deployment needs a build step first.

### Web (`apps/web`)

Uses the Next.js **App Router**. Routes live in `app/`:

| Route | Role |
|---|---|
| `app/page.tsx` | Login / landing |
| `app/home/` | Role-aware home: comedian feed, venue producer dashboard, or admin entry point (`AdminHomeContent`: two stat tiles linking to `/admin/venues`) |
| `app/venues/` | Venue listings and `venues/[id]` detail |
| `app/admin/venues/` | Admin Page A: venue list with status tiles, search and city filter, review actions |
| `app/admin/venues/[id]/` | Admin Page B: one venue's dossier (situation, next actions, Pulse stats, editable profile) |
| `app/profile/` | Profile and `profile/edit` |
| `app/support/` | Support page |
| `app/auth/` | Auth page (logged-out visitors, including blocked admin URLs, are sent here) |

(`/admin-dashboard` and `/venue-dashboard` no longer exist.) `app/admin/layout.tsx` is the admin guard: it asks `GET /api/admin/me`, sends logged-out users to `/auth` and non-admins to the standard 404, and mounts no admin UI until the server says yes.

Shared client-side code lives in `src/`:

- `src/context/AuthContext.tsx` – React context wrapping `AuthProvider`; exposes `useAuth()` hook
- `src/lib/auth.ts` – Auth helpers; user session stored in **localStorage** under key `openmic_user`
- `src/lib/supabaseClient.ts` – Browser Supabase client (uses `NEXT_PUBLIC_*` env vars); `src/lib/apiClient.ts` – `authorizedFetch` (sends the Supabase bearer token; use it for every admin call)
- `src/components/` – `Navbar`, `Sidebar` (never change for admin work), `VenueCard`, `VenueDetailSheet`, `BrandMark`, `CtaButton`, `ModalShell` (the shared modal chrome); feature folders `admin/` (venue review, suspend, edit, Pulse), `venue-dashboard/`, `dashboard/`, `profile/`, `venues/`
- `src/hooks/` – data hooks such as `useAdminVenueList`, `useAdminVenue`, `useAdminVenueStats`, `useOwnerVenueStatus`

### Auth model

`AuthUser` has a `role` field: `"comedian" | "venue_producer" | "admin"`. Session is persisted in localStorage; `AuthContext` hydrates from it on mount. Supabase Auth is used for actual sign-in; the local `AuthUser` object is a mirror stored via `setCurrentUser()`.

A venue has a review status (`pending | approved | changes_requested | rejected`) plus independent hide and suspend flags; the single status shown in the UI comes from `deriveDisplayStatus` (suspended > hidden-if-approved > review status). `venues.admin_approved` is kept equal to `review_status = 'approved'` by a CHECK, so older filters still work. Public reads use "approved, active, not hidden, not suspended" (`publicVenueFilters` in the API, mirrored in RLS). An admin is made by promoting an existing account with the service role or SQL editor: the `users.role` column is protected from client writes and signup can never create an admin.

### Specs and decisions

`specs/` holds one spec per feature. The admin venue work is `specs/admin-venue-management.md` (a section per step, what was verified and what was not) and `specs/decisions.md` (short decision log; add a few lines per decision). Update the spec in the same change as the code.

### Styling

Tailwind CSS v4 with PostCSS. Four Google Fonts are loaded as CSS variables in `app/layout.tsx`: `--font-inter`, `--font-playfair`, `--font-bebas`, `--font-cormorant`. Global styles in `app/globals.css`.

## Environment Variables

`.env` for `apps/api`, `.env.local` for `apps/web`.

| Variable | App | Purpose |
|---|---|---|
| `SUPABASE_URL` | api | Supabase project URL |
| `SUPABASE_ANON_KEY` | api | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | api | Admin/privileged operations |
| `PORT` | api | API port (default 8080) |
| `CORS_ORIGIN` | api | Additional allowed frontend origin |
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase URL for browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase anon key for browser client |
| `NEXT_PUBLIC_API_URL` | web | API base URL (default `http://localhost:8080`) |
| `RAZORPAY_KEY_ID` | api | Razorpay API key id (`rzp_test_…` in test mode, `rzp_live_…` in live) |
| `RAZORPAY_KEY_SECRET` | api | Secret of that key pair, used to call the Razorpay API |
| `RAZORPAY_WEBHOOK_SECRET` | api | Secret that verifies Razorpay webhook signatures (the string set in the dashboard webhook form) |
| `RAZORPAY_MODE` | api | `test` or `live`; must agree with the key id prefix |
| `BILLING_CRON_SECRET` | api | Shared secret for the internal billing reconcile call (needed from Step 10) |

The real values of these variables live in the untracked env files (`apps/api/.env`, `apps/web/.env.local`) and must never be printed, logged or committed; `apps/api/.env.example` and `apps/web/.env.example` hold names and placeholders only. Razorpay variables are API-only, never `NEXT_PUBLIC_*`.

## Conventions
- Before running any bash/terminal command, give a one-line explanation of what that specific command does and why, so the user knows what's running and can judge if it's needed.
- Work in small steps: plan in chat first, wait for "go", update the spec alongside the code, show `git diff --stat` (listing new files, which `--stat` omits), and say plainly what was and was not verified. The user commits; never stash, reset or check out uncommitted work.
- There is no staging database. Live checks run against the real Supabase project: create fixtures with a `TEST – ` name prefix using the service role, never touch real venues or users, and delete everything afterwards, **including the `users` rows** (`auth.admin.deleteUser` does not remove them). Never write credentials into a file git can see.
- Rules that stand for the admin venue feature: address is never selected, shown, searched or edited in admin code; no "verified" feature; DB changes are additive and backward compatible.
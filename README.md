# OpenMic Delhi

OpenMic Delhi is a monorepo for discovering, listing, and managing open mic venues and shows in Delhi, with a Next.js frontend, an Express API, and Supabase-backed persistence.

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Frontend | Next.js | 16.2.0 |
| Frontend runtime | React / React DOM | ^19.2.0 |
| Styling | Tailwind CSS | ^4.2.2 |
| Styling pipeline | PostCSS / @tailwindcss/postcss / Autoprefixer | ^8.5.8 / ^4.2.2 / ^10.4.27 |
| Backend | Express | ^4.21.2 |
| Backend runtime | Node.js + TypeScript + tsx | >=18 / 5.9.2 / ^4.21.0 |
| Database | Supabase / PostgreSQL | TBD in package manifests; schema is PostgreSQL-based |
| Auth | Supabase Auth + client-side local storage session mirror | @supabase/supabase-js ^2.0.0 |
| Monorepo tooling | Turborepo | ^2.9.0 |
| Package manager | npm | npm@10.9.2 |
| Shared types | Internal workspace package | @repo/types 1.0.0 |
| Shared UI package | Internal workspace package | @repo/ui 0.0.0 |
| Linting | ESLint | ^9.39.1 |
| Formatting | Prettier | ^3.7.4 |

## Monorepo Structure

```text
open-mic-tracker/
	apps/ - application workspaces
		api/ - Express API that reads from Supabase and exposes venue, show, and admin endpoints
			src/ - backend source code
				db/ - SQL schema, functions, RLS, and seed data
				lib/ - Supabase client setup
				utils/ - local data helpers
		web/ - Next.js App Router frontend
			app/ - route segments and pages
			public/ - static assets and background imagery
			src/ - shared client-side components, auth context, and API helpers
	packages/ - shared workspace packages
		eslint-config/ - shared ESLint presets
		types/ - shared TypeScript entities for venues and shows
		typescript-config/ - shared tsconfig bases
		ui/ - shared React UI primitives
	package.json - workspace scripts and package manager metadata
	turbo.json - Turborepo pipeline configuration
	README.md - project documentation
```

## Prerequisites

You need Node.js 18 or newer, npm 10.9.2, and a Supabase project with SQL access for the schema and RLS files in `apps/api/src/db`. The repository uses npm workspaces and Turborepo, so no separate package manager is required.

## Environment Variables

### Supabase

| Variable | Required? | Description |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Yes | Public Supabase project URL used by the web client. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Public Supabase anon key used by the web client. |
| SUPABASE_URL | Yes | Supabase project URL used by the API server. |
| SUPABASE_ANON_KEY | Yes | Supabase anon key used by the API server. |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key used for admin RPC calls and privileged reads. |

### API

| Variable | Required? | Description |
| --- | --- | --- |
| PORT | No | API port; defaults to `8080`. |
| CORS_ORIGIN | No | Additional allowed frontend origin for the API CORS allowlist. |
| NEXT_PUBLIC_API_URL | No | Frontend API base URL; defaults to `http://localhost:8080`. |

## Getting Started

1. Clone the repository and move into it.

```bash
git clone <repo-url>
cd open-mic-tracker
```

2. Install dependencies with npm.

```bash
npm install
```

3. Create environment files for the web and API apps with the variables listed above.

4. Apply the database schema in `apps/api/src/db` in this order: `schema.sql`, `functions.sql`, `rls.sql`, then `seed.sql` if you want seeded Delhi data.

5. Start the development stack.

```bash
npm run dev
```

The root `dev` script runs `turbo run dev`, which starts `apps/web` on `http://localhost:3000` and `apps/api` on `http://localhost:8080`.

## Architecture Overview

The frontend is a Next.js App Router app under `apps/web/app` and talks to the backend over HTTP using `NEXT_PUBLIC_API_URL`. The home and venues pages fetch search results and venue detail data from the Express API, while individual forms also use the Supabase JavaScript client directly for auth and profile updates.

Auth is implemented in `apps/web/src/lib/auth.ts` and `apps/web/src/context/AuthContext.tsx`. Supabase Auth is used for comedian and venue producer sign-up and sign-in, but the current user is mirrored into local storage as `openmic_user` for client-side routing and role checks. Admin access is a hard-coded email/password bypass in the frontend auth helper, not a Supabase role flow.

The backend in `apps/api/src/index.ts` is an Express server that reads from Supabase with the anon client for public data and the service-role client for admin actions. It exposes health, venue, show, and admin moderation endpoints, and uses Supabase RPC functions for venue approval and platform stats.

The database layer is plain PostgreSQL schema files in `apps/api/src/db`, not an ORM. `schema.sql` defines the tables and enums, `functions.sql` defines `SECURITY DEFINER` RPC helpers, and `rls.sql` applies row-level security policies.

Role-based access is enforced in two places: the frontend routes redirect users based on the stored role, and Supabase RLS limits what authenticated users can read or mutate. The codebase distinguishes comedian, venue producer, and admin routes, but the admin dashboard still relies on frontend checks plus service-role API calls.

## User Roles

Comedians are routed to `/home` and `/profile`, where they search venues, inspect show availability, and edit their profile. Venue producers are routed to `/venue-dashboard` and can manage venue-related profile data, while their venues are held pending approval until an admin approves them. Admin users are routed to `/admin-dashboard` and `/profile` with admin controls, pending-venue moderation, and platform stats surfaced through the API.

## Key Features (Implemented)

- Role-aware sign-up and login for comedians and venue producers.
- Hard-coded admin login path for local/admin access.
- Local-storage-backed session persistence for the currently active user.
- Venue search and listing pages backed by the Express API and Supabase.
- Venue detail fetches that include upcoming shows for a selected venue.
- Profile view and profile edit flows for all three roles.
- Venue producer onboarding that creates a venue in pending approval state.
- Admin moderation endpoints for approving or rejecting venues.
- Supabase RLS policies for public venue/show reads and per-user profile/bookings access.
- Seed data for Delhi venues and upcoming shows.

## Database Schema

### users

| Field | Notes |
| --- | --- |
| id | UUID primary key. |
| name | Required text, minimum 2 characters. |
| email | Unique required text. |
| password_hash | Required text. |
| role | Enum: comedian, venue_owner, admin. |
| city | Required text, defaults to Delhi. |
| profile_picture | Optional text. |
| phone | Optional phone format check. |
| is_active | Boolean, defaults to true. |
| created_at / updated_at | Timestamp fields with `updated_at` trigger maintenance. |

### venues

| Field | Notes |
| --- | --- |
| id | UUID primary key. |
| owner_id | References users(id). |
| name | Required text. |
| address | Required text. |
| city / state / country | Location fields with Delhi / India defaults. |
| lat / lng | Optional numeric coordinates. |
| photos | Text array, defaults to empty array. |
| description | Optional text. |
| verified | Boolean, defaults to false. |
| admin_approved | Boolean, defaults to false. |
| is_active | Boolean, defaults to true. |
| created_at / updated_at | Timestamp fields with trigger maintenance. |

### shows

| Field | Notes |
| --- | --- |
| id | UUID primary key. |
| venue_id | References venues(id), cascade delete. |
| date | Required date. |
| start_time / end_time | Required time fields with end time greater than start time. |
| spot_type | Enum: busking or non_busking. |
| total_spots | Required integer between 1 and 100. |
| available_spots | Required integer, constrained to be between 0 and total_spots. |
| charge | Required numeric, defaults to 0. |
| is_cancelled | Boolean, defaults to false. |
| created_at / updated_at | Timestamp fields with trigger maintenance. |

### bookings

| Field | Notes |
| --- | --- |
| id | UUID primary key. |
| comedian_id | References users(id). |
| show_id | References shows(id), cascade delete. |
| slots_booked | Integer from 1 to 10. |
| payment_status | Enum: pending, confirmed, refunded, failed. |
| payment_id | Optional text. |
| payment_provider | Text, defaults to razorpay. |
| refund_status | Optional text. |
| booked_at | Timestamp with default `now()`. |

## Contributing

Use a standard fork, branch, and pull request workflow. Branch names should follow `feature/`, `fix/`, or `chore/` prefixes. This is a solo project, so PRs are mainly for personal review and workflow discipline.

## License

Proprietary — all rights reserved.
With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)

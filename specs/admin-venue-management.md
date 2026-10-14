# Admin venue management

**Scope:** admin-only venue management pages (`/admin/venues`, `/admin/venues/[id]`), the admin API behind them, venue-owner visibility of review/suspension outcomes, and the public-side checks that enforce the new venue states. Builds on `specs/admin-dashboard-spec.md` (hide/unhide, venue notices).

Delivered in small steps; each step appends its section below.

> **Resuming in a new session? Read "Handoff: state and remaining work (steps 4-8)" at the bottom of this file first.** It holds the decisions, working rules and the detailed plan for what is left.

## Step 0: lock the unauthenticated admin endpoints

Four admin endpoints previously had no auth (a pre-existing gap noted in `admin-dashboard-spec.md`, deliberately deferred then). They now require a valid session **and** the `admin` role (`requireUser` + `requireRole('admin')`), matching `/api/admin/venues` and hide/unhide:

- `POST /api/venues/:id/approve`
- `POST /api/venues/:id/reject`
- `GET /api/admin/stats`
- `GET /api/admin/pending-venues`

Unauthenticated callers get 401; authenticated non-admins get 403.

Web callers switched from plain `fetch` to `authorizedFetch` (sends the Supabase bearer token) so they keep working:

- `AdminHomeContent`: stats, pending venues, approve, reject.
- `AdminProfile`: the `/api/admin/stats` call only (an import was added for `authorizedFetch`; nothing else in the file changed).

No behavior change for admins; no DB change.

## Step 1a: data model (migration 018)

`apps/api/src/db/migrations/018_venue_review_and_suspension.sql`. Apply manually in Supabase **before** deploying the API change below.

### Venue state

| Column | Notes |
|---|---|
| `review_status` | `pending` \| `approved` \| `changes_requested` \| `rejected`. Default `pending`. |
| `review_reason` | Admin's note for changes-requested / rejected. Cleared on approve; kept on resubmit/reopen so the admin can still see what was asked. May be NULL (legacy rejections) and the UI must render "Rejected" without a reason line. |
| `reviewed_at`, `reviewed_by` | Last admin review action and who did it (FK `users`, set null on delete). |
| `submitted_at` | When the venue (re)entered the pending queue. Backfilled from `created_at`. |
| `is_suspended`, `suspension_reason`, `suspended_at`, `suspended_by` | Suspension is a flag independent of review status. Its RPC (cancel all upcoming spots atomically) ships in migration 021. |

Existing columns are unchanged in meaning. **Invariant (CHECK):** `admin_approved = (review_status = 'approved')`, so every existing filter on `admin_approved` keeps working. `verified` is still set on approve and cleared on reject, as before. No "verified" feature is added.

Backfill: approved stays approved; unapproved with `is_active = false` (the old reject) becomes `rejected` with no reason; everything else is `pending`.

Display status, when several apply: `suspended` > `hidden` > review status.

### Transitions (RPCs, service-role only)

| RPC | From | To |
|---|---|---|
| `admin_approve_venue(p_venue_id, p_admin_id)` | pending, changes_requested | approved |
| `admin_reject_venue(p_venue_id, p_reason, p_admin_id)` | pending, changes_requested | rejected (stays `is_active = true`) |
| `admin_request_changes(p_venue_id, p_reason, p_admin_id)` | pending | changes_requested (reason required) |
| `admin_reopen_venue(p_venue_id, p_admin_id)` | rejected | pending (also sets `is_active = true`) |
| `owner_resubmit_venue(p_owner_id)` | changes_requested | pending |

Each returns `{ success, ... }`; a wrong starting state returns `success: false` with a readable error. The old `admin_approve_venue(uuid)` and `admin_reject_venue(uuid, text)` signatures are dropped and replaced (leaving both would make the existing calls ambiguous); existing calls that pass only `p_venue_id` (and `p_reason`) still resolve through the defaulted `p_admin_id`. The reason is required by the API layer (step 3), not by `admin_reject_venue`, because the current `/home` Reject button sends none.

### Helpers

- `venue_can_operate(owner_id)`: approved, active, not suspended. Will gate spot creation/editing and requests. **Hidden does not block** (hide only removes a venue from public listings).
- `venue_is_public(venue_id)`: the above plus not hidden. Will gate public reads.

### Safety

- `venues_protect_moderation` trigger: a request made with an `anon`/`authenticated` JWT cannot change `owner_id`, `admin_approved`, `verified`, `is_active`, hide, review or suspension columns (the `venues_owner_update_own` policy only checks ownership, so an owner could previously have approved their own venue through PostgREST). Service-role and SQL-editor writes are unaffected.
- `venues_sync_review_status` trigger: if something writes only the legacy columns (`seed.sql`, manual SQL), `review_status` follows (`admin_approved` -> approved; unapproved + inactive -> rejected; else pending).
- The new/replaced functions have `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated` and granted to `service_role` only. **Finding, not changed here:** the older `SECURITY DEFINER` functions (`admin_hide_venue`, `admin_unhide_venue`, `create_show`, `apply_to_spot`, ...) were never restricted and are likely callable with the anon key over `/rest/v1/rpc`. The web app makes no direct `.rpc()` calls, so restricting them looks safe; awaiting a decision.

### Other changes in this step

- `get_platform_stats()`: `pending_approvals` counts `review_status = 'pending'`; `total_venues` excludes rejected venues (they used to drop out through `is_active = false`).
- `GET /api/admin/pending-venues` filters on `review_status = 'pending'` so `/home` does not list changes-requested or rejected venues as pending.
- `packages/types`: `VenueReviewStatus`, `VenueDisplayStatus`. The shared city list is deferred to step 3: `@repo/types` has only ever exported types, and Next has no `transpilePackages`, so a runtime export needs that config added and tested first.

## Step 1b: acceptance history (migration 019)

`apps/api/src/db/migrations/019_spot_request_acceptance_history.sql`. Apply manually after 018.

`spot_requests.status` is overwritten on cancel and `decided_at` on every transition, so "ever accepted" and "cancelled from which state" were unrecoverable. Two additive columns fix that going forward:

| Column | Meaning |
|---|---|
| `accepted_at` | When the request was first accepted. Kept if a swap later sends it back to `pending` or it is re-accepted. |
| `cancelled_from_status` | The status it held when it became `cancelled_by_comedian` / `cancelled_by_venue` (`pending`, `waitlisted` or `accepted`). |

**Implemented as a trigger** (`trg_spot_requests_track_status`), not by editing the existing functions. The earlier plan was to rewrite `accept_spot_request`, `comedian_cancel_spot_request`, `venue_cancel_spot_request` and `cancel_show`; reading them showed a fifth status-changing path (`update_show` cancels pending/waitlisted requests when a pool drops to zero) plus the swap in `accept_spot_request`. A trigger records every path, including manual SQL and the suspend RPC (migration 021), with no rewrite of working code. On INSERT the two columns are forced server-side because comedians can insert their own request rows directly (policy `spot_requests_insert_own`).

**History:** currently accepted requests are backfilled with `accepted_at = decided_at`. Older cancelled requests stay NULL, shown as "n/a".

**Stats rules (used in step 7):**
- *Acceptance rate* = requests ever accepted (`accepted_at IS NOT NULL`) over requests whose acceptance is knowable: those created after this migration, plus older ones still pending, waitlisted or accepted. Older cancelled requests are excluded and the UI notes how many. No knowable requests shows "n/a".
- *Cancellations after acceptance* = `cancelled_from_status = 'accepted'`, split by who cancelled. Older cancelled requests show "n/a" for this split.
- *Cancelled shows* (`venue_shows.is_cancelled`) are exact for all history.
- A swap release (accepted -> pending) is not a cancellation.

## Step 2: admin-only access and the Page A shell

### Display status (refinement of step 1a)

Each venue has exactly one display status, so status counts add up to the total: `suspended` if `is_suspended`; else `hidden` **only if the venue is approved**; else its review status. A hidden venue that is still pending / changes-requested / rejected keeps its review status (so it never drops out of the review queue) and shows a small "Also hidden" marker. Implemented in `apps/web/src/lib/venueStatus.ts`.

### API (`apps/api/src/index.ts`)

- `app.use('/api/admin', requireUser, requireRole('admin'))`: default-deny for everything registered under `/api/admin` after it. New admin routes go below it; the four older `/api/admin/*` routes keep their own per-route guards (harmless duplicate lookup).
- `GET /api/admin/me`: `{ id, name, role: 'admin' }`. The `/admin` UI uses it to ask the server, not localStorage, whether the session is an admin.
- `GET /api/admin/manage/venues`: every venue in every state with review/hide/suspension fields and owner name/email, oldest submission first. **No address.** The older `GET /api/admin/venues` (used by `/home`'s Manage Venues) is untouched. Both retire in step 8.

401 for no/invalid token, 403 for a signed-in non-admin.

### Web

- `app/admin/layout.tsx`: client guard. Logged out -> `/auth`; signed in non-admin -> the standard 404 (`notFound()`); server/network failure -> a retry screen. Until `/api/admin/me` says yes only a "Loading..." line renders, so no admin UI or data is mounted for anyone else. The `/admin` JS chunks are downloadable by anyone who guesses the URL, but contain no data. Wraps pages in the same Navbar + Sidebar shell as `/home`.
- `app/admin/venues/page.tsx` (Page A, read-only for now): status summary strip (counts that double as filters; Pending review is the dominant tile), a "Needs your attention" zone (pending venues, longest-waiting first), and the rest as a table on md+ / cards on mobile. Row links to Page B and all actions arrive in later steps; name search and the city filter arrive in step 5.
- Navbar: admin-only "Venue Management" entry in the mobile menu's Profile group and an "Admin" link in the desktop bar (the desktop bar has no profile dropdown, only an avatar linking to `/profile`). Display only; not a security control.
- New components in `src/components/admin/`: `StatusBadge` (icon + label + flat tint; suspended is an outline), `StatusIcons`, `ReasonNote` (italic Cormorant quote with a colored rule; renders nothing for an empty reason), `StatusSummaryStrip`, `VenueReviewCard`, `VenueListItem`. Hook: `useAdminVenueList`.
- Status colors: pending amber `#fbbf24`, changes requested orange `#fb923c`, approved green `#4ade80`, hidden zinc `#a1a1aa`, rejected red `#f87171`, suspended red `#ef4444` outline. Subject to the Page A visual review.

## Step 3a: review actions (admin side)

Step 3 is delivered in two parts. 3a (this section) is the admin side; 3b adds the owner dashboard status panel, the "Fix and resubmit" modal, `PATCH /api/venues/mine` for name/city/description, and the server-side gate on spot creation. **Until 3b ships, requested changes and rejection reasons are stored but the owner has nowhere to read them, and pending venues can still create spots.**

### API (all under the `/api/admin` default-deny guard)

| Route | Body | RPC |
|---|---|---|
| `POST /api/admin/manage/venues/:id/approve` | none | `admin_approve_venue` |
| `POST /api/admin/manage/venues/:id/reject` | `{ reason }` required | `admin_reject_venue` |
| `POST /api/admin/manage/venues/:id/request-changes` | `{ reason }` required | `admin_request_changes` |

- The acting admin's id is passed as `p_admin_id` (stamped on `reviewed_by`).
- Reason: string, trimmed, non-blank, at most 500 characters, else 400.
- Non-UUID `:id` or unknown venue: 404. Wrong starting state (e.g. already approved by another admin): 409 with the RPC's message. The RPC checks state and updates in one statement, so two admins racing cannot both succeed.
- Transitions are the ones in the step 1a table: approve and reject from pending or changes-requested; request-changes from pending.

### Web

- `ModalShell` (`src/components/ModalShell.tsx`): the Requests modal's chrome (overlay under the navbar and beside the sidebar, solid navy glass panel, Bebas header, 44px close, click-outside), plus dialog semantics, Escape and focus restore. Extracted into a new file; `RequestsPanel` is untouched. The owner-side modal in 3b reuses it.
- `ReviewActionModal`: one modal for approve (confirm only), request changes and reject (required reason in a `float-field` textarea with a 500-character counter, and a live "The owner will read" preview in the italic note style). Double-submit is locked; the modal cannot be dismissed while the request runs; an API error shows inline and keeps the modal open.
- `VenueReviewCard` in the "Needs your attention" zone gains Approve / Request changes / Reject (global `CtaButton`; reject uses the danger variant). After success: a toast, a 200ms fade-out of the card, then a list refresh. A failed action refreshes the list too, in case the venue moved on.
- Changes-requested and rejected venues in the list have no actions yet; approving or reopening them comes with Page B (step 6).

### Known gap until step 8

The old `/home` Pending Approvals buttons still call `POST /api/venues/:id/approve|reject`. Reject there sends no reason (the RPC tolerates a blank one), so a venue can still be rejected without a reason from `/home`. This disappears when `/home`'s pending list is replaced in step 8.

## Step 3b: owner visibility, fix-and-resubmit, spot gate

Migration numbering: the spot gate is **020**; the suspend RPC moves to **021**.

### Owner API (`apps/api/src/index.ts`)

- `GET /api/venues/mine/status` (venue producer): `{ id, name, city, description, review_status, review_reason, reviewed_at, submitted_at, is_suspended, suspension_reason, suspended_at, can_operate, can_edit_details, allowed_cities }`. Does not expose hide state. `can_operate` = approved, active, not suspended. `can_edit_details` = pending or changes requested.
- `POST /api/venues/mine/resubmit`: changes_requested -> pending via `owner_resubmit_venue`. 404 no venue, 409 wrong state. The previous `review_reason` is kept so the admin sees what was asked.
- `PATCH /api/venues/mine` and `PATCH /api/venues/:id` now also accept `name`, `city`, `description`, **only while the venue is pending or changes_requested**; otherwise 409 and nothing is written (the status check is part of the UPDATE, so an admin approving at the same instant cannot be raced). Validation: name 2-100 chars, description at most 1000, city one of `allowed_cities` (Delhi, Mumbai, Bangalore, Pune) or the venue's existing city unchanged. The link/contact fields keep working in every status. **Address is not editable anywhere.** The API is the single source for the city list; `@repo/types` still exports types only.

### Owner web

- `VenueStatusSection` on the owner dashboard (above "+ Add new shows"), reading the venue row directly, not the one-off "Notices from Admin" messages. Nothing renders for an approved venue. Pending: "under review" with an Edit details button. Changes requested: the admin's note in the italic style and a Fix and resubmit button. Rejected: the reason (blank reason shows nothing) and "This decision is final" with a link to support. (A suspended banner arrives in step 4.)
- `VenueDetailsModal` (Requests-modal style via `ModalShell`): edit name, city and description. In resubmit mode it shows the admin's note, saves any changes, then resubmits; if the save succeeds but the resubmit fails it says so and a retry does not re-save. Edit mode (pending) saves only.
- "+ Add new shows" is disabled with "Adding shows unlocks once your venue is approved." when the venue cannot operate. Cosmetic: the server enforces it.
- `/profile/edit`: the Venue Name field is editable only while pending/changes-requested (it now actually saves, through `PATCH /api/venues/mine`, and updates the stored `venueName`); otherwise read-only with a note. The localStorage keys are unchanged.

### Spot gate (migration 020)

Triggers on `venue_shows`, `spots` and `spot_requests` call `venue_can_operate` (approved, active, not suspended; **hidden does not block**). For a venue that cannot operate they block: creating a show or spot pool; changing a show's date or a pool's date/size/price or re-activating a cancelled pool; a comedian requesting a spot; accepting or promoting a request. They never block cancelling (shows, spots, requests), a comedian cancelling their own request, `available_spots` bookkeeping or swap releases, and nothing existing is deleted or hidden. Existing pending venues keep any shows they already created; the owner just cannot add or change them.

Triggers rather than edits to `create_show` / `update_show` / `apply_to_spot` / `accept_spot_request`: they also cover direct PostgREST writes under the owner RLS policies, which an API-only check would miss. Those functions already return `{ success: false, error }` on an exception, so the message reaches the existing UI error lines. Writes with no JWT claims at all (SQL editor, migrations) are exempt so seeding keeps working; every PostgREST call, including the API's service-role client, is checked.

Not covered yet (step 4): the legacy `shows`/`bookings` path (`POST /api/shows/:id/book`) and the public read paths for suspended venues.

## Handoff: state and remaining work (steps 4-8)

Written at the end of the first session so work can resume cold. The sections above are the record of what was built; this section is what to do next.

### Where things stand

| Step | Status |
|---|---|
| 0 lock unauthenticated admin endpoints | Built, reviewed. |
| 1a migration 018 (review status, suspension columns, RPCs, triggers) | **Applied** (user confirmed; backfill verified: 11 venues, all approved, 10 of them hidden). |
| 1b migration 019 (`accepted_at`, `cancelled_from_status` trigger) | **Applied** (user confirmed). |
| 2 admin guard, `/api/admin` prefix, Page A shell | Built. Server checks done; user reviewing visually. |
| 3a admin review actions (approve / reject / request changes) | Built; user confirmed Request changes works. |
| 3b owner status panel, Fix and resubmit, `PATCH /api/venues/mine`, spot gate | Built. **Migration 020 written but NOT confirmed applied. Ask the user to apply it before testing 3b.** Nothing in 3b has been exercised with real tokens or in a browser. |
| 4 suspend | **Not started. Resume here.** |
| 5 search and filters | Not started. |
| 6 Page B (dossier + edit) | Not started. |
| 7 stats | Not started. |
| 8 `/home` cleanup | Not started; must be LAST. |

Nothing is committed. The working tree also holds the user's own uncommitted work (`RequestsPanel.tsx`, `safeLinks.ts`, `specs/venue-dashboard.md`): never touch, stash, reset or check out those or any uncommitted file (use `git diff` / `git show`, not stash).

### Working rules (the user's, from this session)

1. **Small, independently reviewable steps.** Build one step, show `git diff --stat`, update `specs/*.md` in the same step, then stop and wait. Do not start the next step without "go".
2. Before every Bash command give a one-line explanation of what it does and why (CLAUDE.md convention).
3. **Plan first, wait for approval** before any non-trivial new step; call out anything that deviates from the agreed plan (e.g. 019 as a trigger instead of rewriting four functions; the spot gate as triggers).
4. DB changes are **additive and backward compatible**; keep localStorage keys, existing DB values and identifiers. Migrations are applied manually by the user in the Supabase SQL editor (nothing can run Postgres locally, so SQL is unrun until the user applies it; say so every time).
5. Tests: `npm run check-types`, ESLint on changed files, plus a curl role matrix (no token, comedian, venue owner, admin) against every admin endpoint. The user promised test accounts (one comedian, one venue owner, one admin, venues in several states); until they are supplied only the no-token/bogus-token (401) half can be run. Report honestly what was and was not verified.
6. Design: dark glassmorphism using the global `.glass-panel` (the `/support` page is the blur/opacity reference); cyan `#38BDF8`; Bebas Neue headings and Cormorant Garamond italic voice (`font-[family-name:var(--font-cormorant)] italic`); **flat solid colors only: no gradients, no glow**; SVG icons only, no emojis; mobile-first; modals built on `ModalShell` (the Requests-modal chrome); buttons are `CtaButton`, inputs are `float-field`/`float-input` (no new button or input styles); no new dependencies or animation libraries. Status is always icon + label + color.
7. **No "verified" feature** anywhere (no flag, column or badge beyond the existing `verified` column that approve already set).
8. **Address is out of scope**: no editing, display, search or new logic anywhere, including admin edit and every new endpoint (do not `select` it in new code).
9. Do not touch comedian features, payments or user management.

### Environment notes

- Web dev server runs on :3000 and the API (`tsx watch`) on :8080, usually already running; the web proxies `/api/*` to the API. Check with `curl localhost:8080/api/health` before starting another.
- `apps/api` has no tsconfig, so Turbo's `check-types` skips it. Typecheck ad hoc: `cd apps/api && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck src/index.ts` and compare only the lines you changed: the file has old errors (the `req.params` `string | string[]` class and the pools-parser narrowing). I coerce with `String(req.params.id)` in new code.
- The shell is zsh: unquoted `$var` does not word-split. Use `${=var}` or arrays in loops (this broke a curl probe once).
- ESLint rejects directory arguments here; pass explicit file paths.
- `@repo/types` exports **types only** (no runtime values) and Next has no `transpilePackages`, so a runtime export from it can break the web build. The allowed-cities list therefore lives in the API (`VENUE_CITIES` in `apps/api/src/index.ts`) and clients read it from `GET /api/venues/mine/status`.
- Core code map: API routes all in `apps/api/src/index.ts`; admin routes live below `app.use('/api/admin', requireUser, requireRole('admin'))`. Admin web: `apps/web/app/admin/` (`layout.tsx` guard, `venues/page.tsx`), components in `apps/web/src/components/admin/`, owner side in `apps/web/src/components/venue-dashboard/` (`VenueStatusSection`, `VenueDetailsModal`), helpers `src/lib/venueStatus.ts`, hooks `useAdminVenueList`, `useOwnerVenueStatus`. Migrations in `apps/api/src/db/migrations/` (018 to 020 are this project's).

### Decisions already made (do not re-ask)

- **Suspension is option B.** Suspending cancels **all upcoming spots**; every pending/accepted/waitlisted request on them becomes `cancelled_by_venue` with a message. No freeze mode, no checkbox. **Unsuspend does NOT restore anything.** The suspend modal must say so clearly, show how many upcoming shows and requests will be cancelled, require a reason, and require explicit confirmation (type the venue name). Only upcoming spots are affected; past spots and history untouched. Suspension and the cancellations succeed or fail together (one transaction). Affected comedians are notified through the existing cancellation path (the Reminders section shows `cancelled_by_venue` requests for 24h), same as a normal cancellation. **The comedian-facing message is a neutral fixed text, never the admin's reason**; the owner sees the full reason on their dashboard.
- Rejection is terminal for the owner (sees reason, pointed to support). Only changes-requested venues can resubmit. The admin can move a rejected venue back to pending from Page B (`admin_reopen_venue` already exists).
- Pending venues cannot create spots (enforced server-side by migration 020). Any spots pending venues already created are not deleted or hidden.
- Legacy rejected venues (`is_active = false`, unapproved) are all mock data: no special backfill or placeholder reason; the UI must simply not crash on a rejected venue with an empty reason (it shows "Rejected" with no reason line).
- Photos: URL-only editing, https only, max 8 URLs, validated server-side (also cap URL length, 2048). Uploads are deferred.
- Admin edit whitelist: name, city, description, photo URLs, Instagram, X, Maps, contact email, contact phone. Never `owner_id`, ids, moderation columns, `verified`, or address.
- Status colors approved as proposed (pending amber `#fbbf24`, changes requested orange `#fb923c`, approved green `#4ade80`, hidden zinc `#a1a1aa`, rejected red `#f87171`, suspended red `#ef4444` outline), always with icon + label; the user will review exact colors at the Page A visual review.
- The `/home` cleanup (step 8) happens only after Pages A and B are working and reviewed. Entry points: admin-only Navbar item (done) plus a count tile on `/home` (step 8). The shared Sidebar is never touched.
- Admin guard behavior (done): logged out -> `/auth`; signed-in non-admin -> standard 404; no admin data in anything a non-admin can download.
- The existing `AdminProfile` venue list stays untouched (known limitation, documented below); only its `/api/admin/stats` call was changed (step 0).
- Migration 019's stats rules are in the Step 1b section (acceptance rate over "knowable" requests; n/a otherwise).

### Step 4: suspend (next; propose then wait for "go", suggested split below)

**Migration 021** (`021_venue_suspension.sql`, additive, `BEGIN/COMMIT`, `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role`):
- `admin_suspend_venue(p_venue_id, p_reason, p_admin_id)`: one plpgsql function, **no `EXCEPTION WHEN OTHERS` block** (an error must roll the whole thing back) and **do not loop over `cancel_show`** (it swallows errors and returns JSON). Only from `review_status = 'approved'` and not already suspended; reason required. Sets `is_suspended`, `suspension_reason`, `suspended_at`, `suspended_by`; then in the same transaction does the set-based equivalent of `cancel_show` for every *upcoming* show of the owner (`venue_shows` and `spots` `is_cancelled = true` with a neutral `cancellation_message`; `spot_requests` in pending/accepted/waitlisted -> `cancelled_by_venue`, `decided_at = now()`, `venue_message` = the neutral text). The 019 trigger records `cancelled_from_status`. Returns counts (shows, spots, requests, comedians) for the success toast.
- **Upcoming predicate** (one shared SQL function, used by both the preview and the suspend): not cancelled and end time not yet passed in `Asia/Kolkata` (`(date + end_time) > (now() AT TIME ZONE 'Asia/Kolkata')`).
- `admin_unsuspend_venue(p_venue_id, p_admin_id)`: clears the flag/fields only; restores nothing.
- `venue_suspension_preview(p_venue_id)`: counts of upcoming shows, spot pools, requests by status, distinct comedians, using the same predicate.
- Confirm the 020 gate does not block the suspend's own writes: the gate fires on spots/venue_shows date/size/price changes and re-activation and on accept, not on `is_cancelled = true`, so it should not; verify. (Admin writes come through the service role with JWT claims, so the gate applies to them.)

**API** (under the admin prefix): `GET /api/admin/manage/venues/:id/suspension-preview`, `POST .../suspend` (`{ reason }` required, <= 500 chars), `POST .../unsuspend`; 404/409 mapping like `runVenueReviewAction`; UUID check.

**Web:** suspend modal on `ModalShell` with a `ConfirmByTyping` component (a `float-input` that must equal the venue name before the danger `CtaButton` enables), a "what will happen" block with live counts, the plain statement that unsuspending will not restore anything, and a required reason. Unsuspend confirm. Where to launch from: Page B (step 6) is the main home; for step 4 add suspend/unsuspend as a row action menu on Page A for approved/suspended venues (or defer the UI to step 6 and ship only API + owner banner + enforcement in step 4: decide with the user). Owner side: add a **suspended banner** to `VenueStatusSection` (currently it renders nothing for approved venues): show suspended status + reason + "contact support"; `can_operate` already disables Add shows.

**Enforce suspended/hidden on every public path** (nothing may leak):
- `GET /api/venues` (add `.eq('is_suspended', false)`), `GET /api/venues/:id` (**also add `is_hidden = false` and `is_suspended = false`; today a hidden venue's detail and spots are reachable by id**; keep owner-only access to own venue separate), `GET /api/shows` (add `venues.is_suspended = false` to the join filters), `GET /api/spots` (venue filter), `GET /api/me/favorite-venues` / `GET /api/me/bookings/pending` (venue info for suspended venues: decide), `POST /api/spot-requests` (the 020 gate covers it), the web pages `venues`, `venues/[id]`, `ComedianHomeContent` (handle 404 gracefully).
- **Legacy System-1:** `POST /api/shows/:id/book` -> `book_show_spot` has no venue check and is open to any authenticated user. Gate it (a `venue_is_public` check in the API, or a trigger on `bookings` INSERT using the show's `venue_id`).
- **RLS** (ask the user first; it changes direct anon reads): tighten `spots_public_read`, `venue_shows_public_read` and `shows_public_read` so spots of unapproved/hidden/suspended venues are not readable with the anon key. All app reads go through the API with the service role, so nothing in the app should break.
- Use the helpers `venue_can_operate(owner_id)` and `venue_is_public(venue_id)` from 018; keep the TS filters in one place rather than scattered ad hoc conditions.
- Suggested split to keep diffs reviewable: **4a** migration 021 + API + owner banner; **4b** public-path enforcement + legacy gate + RLS (+ the suspend UI if not in 4a).

### Step 5: search and filters (Page A)

Server-side query params on `GET /api/admin/manage/venues`: `q` (venue **name only**, case-insensitive), `status` (one of the six display statuses; remember hidden = approved + hidden and suspended wins), `city`; keep the status strip counts correct (counts over the unfiltered set, or add a counts payload). UI: a `float-input` search field with a clear button (pattern in `ManageVenuesSection`) and a city control. **Do not reuse `FilterPills`** (spot-specific, has a glow shadow). Reuse the existing `<select>` styling the profile-edit page uses (or the `float-input` select used in `VenueDetailsModal`); do not invent new input styles. Keep the mobile card layout; add loading/empty states in the established voice.

### Step 6: Page B `/admin/venues/[id]` (the "dossier")

- **API:** `GET /api/admin/manage/venues/:id` (all venue fields **except address**, owner info, the three reasons with who/when via `reviewed_by`/`suspended_by` names); `PATCH /api/admin/manage/venues/:id` with the whitelist above, same validation as the owner path plus photos (https only, max 8, <= 2048 chars each; reuse one shared validator for owner and admin), city must be in `VENUE_CITIES` or unchanged; atomic and field-whitelisted, never touching `owner_id`, ids or moderation columns; `POST .../reopen` (rejected -> pending via `admin_reopen_venue`); approve/reject for a changes-requested venue via the existing endpoints; hide/unhide: reuse `POST /api/venues/:id/hide|unhide` (admin-guarded) or add manage-prefixed wrappers, keeping their behavior unchanged. Every action takes `p_admin_id` (audit log later plugs in with one INSERT per function; do not build the audit log now).
- **Web:** `app/admin/venues/[id]/page.tsx` under the existing guard layout. Dossier feel, not a form: (1) header (name in Bebas, city, owner, status badge); (2) a **Situation** panel (current status + its reason in the italic note + since when/by whom, plus hidden/suspended flags and counts); (3) a state-aware **Next actions** panel: pending -> Approve / Request changes / Reject; changes_requested -> Approve / Reject (waiting on owner); rejected -> Move back to pending; approved -> Hide or Unhide / Suspend; suspended -> Unsuspend; (4) **Profile** panel read view with an Edit toggle switching fields in place (name, city, description, photo URL list via a new `PhotoUrlListEditor`, Instagram, X, Maps, contact email, phone), Save/Cancel and an unsaved-changes warning; (5) the stats panel (step 7). Mobile: single column in that order. Link Page A rows and review cards to Page B (they are not linked yet). No address anywhere. Reasons history is only the current reasons until the audit-log task exists; say so in the UI copy/spec rather than inventing a timeline.
- Reuse `StatusBadge`, `ReasonNote`, `ModalShell`, `ReviewActionModal`, `CtaButton`, `float-field`.

### Step 7: venue stats on Page B

`GET /api/admin/manage/venues/:id/stats` and a distinctive "pulse" panel (not four identical boxes): a large Bebas "requests received" figure, a flat stacked bar of outcomes (pending / accepted / waitlisted / cancelled) in the Requests-panel status colors (pending `#facc15`, accepted `#38bdf8`, waitlisted `#a1a1aa`), the acceptance rate as a flat SVG ring, plus spots created and cancellations (by venue / by comedian / after acceptance). Data: spots created = count of `venue_shows` for `venues.owner_id` (a show has up to 3 pool rows; show the number of shows, label it); requests received = `spot_requests` joined through `spots.venue_producer_id`; cancelled shows = `venue_shows.is_cancelled` (exact for all history). Acceptance rate and "cancelled after acceptance" follow the 019 rules in the Step 1b section; show a graceful italic "n/a" with a note ("recorded from <migration date>", and "n older requests excluded") rather than a proxy. Venues with a null `owner_id` show zeros/"no owner". The legacy `shows` table is not part of these stats.

### Step 8: `/home` cleanup (last, only after A and B are reviewed)

Replace the pending-approvals list and `ManageVenuesSection` in `AdminHomeContent` with a count tile linking to `/admin/venues` (pending count from `GET /api/admin/stats`, which now counts `review_status = 'pending'`). Then retire what nothing uses any more: `useAdminVenues`, `ManageVenuesSection`, `HideVenueDialog`, `VenueActionSheet`, `GET /api/admin/venues`, `GET /api/admin/pending-venues`, and the old unreasoned `POST /api/venues/:id/approve|reject` (this closes the known gap where `/home` can reject without a reason). Update `specs/admin-dashboard-spec.md` to point at this spec. Leave `AdminProfile` and the shared Sidebar alone.

### Open items and flags for the user

- **Older `SECURITY DEFINER` functions are not restricted.** `admin_hide_venue`, `admin_unhide_venue`, `create_show`, `update_show`, `cancel_show`, `apply_to_spot`, `accept_spot_request`, `book_show_spot` etc. likely have `EXECUTE` for PUBLIC and are callable with the anon key over `/rest/v1/rpc`. The web app makes no direct `.rpc()` calls, so revoking from `PUBLIC, anon, authenticated` and granting to `service_role` looks safe; the user has not decided. Ask.
- `POST /api/bookings/:id/confirm` (a test helper) is unauthenticated. Out of scope; flagged.
- The signup trigger that creates `public.users` is not in the repo. Ask the user to confirm a user cannot sign up with `role: 'admin'` in auth metadata.
- Pre-seeded states the user may still need to create for testing: pending, changes-requested (via the UI now), rejected with and without reason, hidden (10 already), suspended (after step 4), a venue with upcoming shows and requests in pending/accepted/waitlisted (including the same comedian on two pools of one show) for the suspend test, a second city, and a venue with null owner.
- Pending shows already created by pending venues: the count was never queried (it needs DB access). The query is in the conversation notes: join `venues` (unapproved) to `venue_shows`/`spots` on `owner_id = venue_producer_id`. Report the number if the user supplies it.
- Whether the owner-side "Fix and resubmit" and the admin flows behave end to end is **unverified** until the user tests with real accounts.

## Known limitations

- **`AdminProfile` "All Venues" list uses the old two-state Approved/Pending badge.** It predates the review and suspension states, so a suspended venue may appear there as "Approved", and unapproved venues of any kind show as "Pending". `/admin/venues` is the source of truth for venue status; this list is a known limitation until it is retired. It was intentionally left untouched.

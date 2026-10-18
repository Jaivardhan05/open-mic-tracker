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

## Step 4a: suspend (SQL, API, owner banner)

Step 4 is delivered in two parts. 4a (this section) is the suspend/unsuspend backend and the owner-side banner; 4b is public-path enforcement, the legacy gate and RLS. **There is no admin UI for suspend in 4a**: the suspend modal ships with Page B in step 6 (see that step), so until then suspend is reachable only through the API.

### Migration 021 (`021_venue_suspension.sql`)

**Written but NOT yet applied: apply it in the Supabase SQL editor before the API routes below are used.** SQL cannot run locally, so it is unrun until then.

| Function | Behavior |
|---|---|
| `venue_show_is_upcoming(date, end_time)` | The one shared predicate: `(date + end_time) > now() AT TIME ZONE 'Asia/Kolkata'`. Used by both the preview and the suspend. Shows never run past midnight (`end_time > start_time` is a CHECK). A show in progress counts as upcoming. |
| `venue_suspension_preview(p_venue_id)` | `{ success, shows, spots, requests: { pending, accepted, waitlisted, total }, comedians }`; "Venue not found" for an unknown id. |
| `admin_suspend_venue(p_venue_id, p_reason, p_admin_id)` | Row-locks the venue; only from `approved` and not already suspended; reason required. Sets the four suspension columns, then cancels in the same transaction: the owner's upcoming `venue_shows`, their not-yet-cancelled `spots`, and every pending/accepted/waitlisted request on them (`cancelled_by_venue`, `decided_at = now()`). Returns `{ success, shows, spots, requests, comedians }`. |
| `admin_unsuspend_venue(p_venue_id, p_admin_id)` | Only when suspended. Clears `is_suspended`, `suspension_reason`, `suspended_at`, `suspended_by`. Restores nothing. The reason is not kept (no audit log yet). |

- **No `EXCEPTION` block** in the suspend: any error rolls the flag and every cancellation back together. It does not call `cancel_show` (which swallows errors).
- **Fixed neutral texts**, never the admin's reason: shows and pools get "This show was cancelled because the venue is temporarily unavailable."; requests get `venue_message` "This request was cancelled because the venue is temporarily unavailable." The owner sees the full reason on their dashboard.
- Pools already cancelled on their own keep their original message. `available_spots` is untouched (as in `cancel_show`).
- The 019 trigger records `cancelled_from_status`. The 020 gate does not block these writes (traced from the SQL: it ignores an unchanged show date, an unchanged pool date/size/price without re-activation, and any status change that is not "-> accepted"). Only the real API path (service role with JWT claims) exercises the gate; the SQL editor has no claims and is exempt.
- Hidden does not matter: a hidden approved venue can be suspended. A venue with no owner can be suspended and cancels nothing.
- All four functions: `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` revoked from `PUBLIC, anon, authenticated`, granted to `service_role`.
- **Known narrow race:** an owner request that passed the 020 gate just before the suspend commits could create a show after the cancellations ran. It needs two requests in the same instant; not guarded.
- **Assumption:** one venue per owner (shows and spots are keyed by `venue_producer_id`; `venues.owner_id` is not unique). True in the current data; if an owner ever had two venues, suspending one would cancel both venues' shows.

### API (under the `/api/admin` default-deny guard)

| Route | Body | RPC |
|---|---|---|
| `GET /api/admin/manage/venues/:id/suspension-preview` | none | `venue_suspension_preview` |
| `POST /api/admin/manage/venues/:id/suspend` | `{ reason }` required (trimmed, non-blank, <= 500) | `admin_suspend_venue` |
| `POST /api/admin/manage/venues/:id/unsuspend` | none | `admin_unsuspend_venue` |

Same mapping as step 3a (`runVenueReviewAction`, whose RPC-name union was widened; nothing else in it changed): non-UUID or unknown venue 404, wrong state 409 with the RPC's message, missing reason 400. The preview counts and the suspend counts can differ if something changes in between; the suspend response carries the real numbers.

### Web

- `VenueStatusSection` (owner dashboard): a suspended branch, shown before the approved early-return because suspension is a flag on top of the review status. Suspended badge (outline), "Your venue is suspended", the admin's full reason in the italic note, and plain copy: off /venues, upcoming shows and their requests were cancelled, lifting the suspension will not bring them back, contact support.
- `VenueProducerDashboard`: the line under the disabled "+ Add new shows" now reads "Adding shows is paused while your venue is suspended." for a suspended venue (it used to say "unlocks once your venue is approved", which was wrong for suspended). Other cases unchanged.

### Verified / not verified

Verified at build time: `npm run check-types`, ESLint on the two changed web files, API typecheck (only the old known errors), 401 on all three routes with no or a bogus token.

**Verified live (2026-10-15, test accounts, real DB; migration 021 applied):**
- Role matrix: no token 401, comedian 403, owner 403 on preview, suspend and unsuspend.
- Preview returned the right counts (1 show, 1 spot, 1 pending request, 1 comedian). Suspend without a reason: 400.
- Suspend: venue flagged with reason, time and admin id; the venue_show and spot cancelled with the neutral text; the pending request became `cancelled_by_venue` with the neutral request text, `decided_at` set and `cancelled_from_status = pending`. An existing legacy booking was untouched.
- While suspended: `GET /api/venues/:id` is 404; the venue is absent from `/api/venues`, `/api/shows` and `/api/spots`.
- Suspend again 409 "already suspended"; unsuspend OK and clears the four suspension fields; unsuspend again 409; the venue is public again and the cancelled show stays cancelled.
- 020 gate with a live spot at a suspended venue (suspended flag set directly to simulate the race window): owner create-show via the API is refused, a direct PostgREST insert into `venue_shows` with the owner's JWT is refused, and a comedian request to the live spot is refused. After the flag was cleared, create-show works again.

**Not verified:** the owner banner in a browser (needs a person to log in as the test owner), and the suspended text of `/api/venues/mine/status` as returned over the API (the database values were checked, the endpoint was read only while the venue was not suspended).

## Step 4b, part 1: protect `users.role` (migration 022)

Found while checking whether an admin-read RLS policy (4b, later) could trust `users.role`. **Applied** (user confirmed).

### Finding

A signed-in user can very likely make themselves an admin. Evidence from the user's SQL editor: the only policy on `users` for updates is `users_update_own` (`USING` and `WITH CHECK` are both just `auth.uid() = id`); `has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE')` is `true`; the only trigger on `users` is `update_users_updated_at`. So `UPDATE users SET role = 'admin'` on one's own row through PostgREST with the anon key is allowed. The API's `requireRole` reads `users.role` with the service role, so that account would pass every admin guard (approve, reject, suspend, hide, `/admin`). Not exercised against the live database (no test user was created); the policy, privilege and trigger list leave nothing that would stop it. At the time of checking there was exactly one admin account (the user was asked to confirm it is theirs).

`users_service_role_read_all` (`TO service_role`) turned out to be harmless: the service role bypasses RLS and the policy is not granted to anon or authenticated, so it is not a leak.

### Fix: `022_protect_user_role.sql`

`users_protect_role()` and trigger `users_1_protect_role` (`BEFORE INSERT OR UPDATE ON users`), the same pattern as `venues_protect_moderation` (018): under an `anon` / `authenticated` JWT, a role change on UPDATE is rejected (`42501`), and an INSERT with `role = 'admin'` is rejected (compared as text, so independent of the enum labels). The service role, the SQL editor and the auth service's signup trigger (no request JWT claims) are unaffected. Nothing in the web app writes `role` (checked `profile/edit` and `lib/auth.ts`). The migration header contains an atomic self-test to run after applying.

### Still open

- ~~`handle_new_user` copies the signup metadata role~~ **Confirmed real and fixed by 022b** (see "Step 4b, part 3").
- Other columns on `users` that a user can update on their own row have not been reviewed.

022 was applied by the user (they reported it ran successfully; the self-test result was not reported separately). The single admin account is the user's own.

## Step 4b, part 2: public-path filters and the legacy booking gate

### API (`apps/api/src/index.ts`)

One helper, `publicVenueFilters(query, prefix?)`, defines "a venue the public may see": approved, active, not hidden, not suspended (mirrors `venue_is_public`). Applied to:

- `GET /api/venues`: now also excludes suspended.
- `GET /api/shows`: legacy `shows` joined to venues (`venues.` prefix); the embed now also selects `is_suspended`.
- `GET /api/venues/:id`: now excludes hidden **and** suspended, so both return 404. This is a visible change: it used to ignore `is_hidden`, so a hidden venue's detail and spots were reachable by id. Currently 9 of the 11 venues are approved+hidden, so their detail pages now 404.
- `GET /api/spots`: venue filter via the helper.
- `GET /api/me/favorite-venues` was filtered to public venues here; the endpoint and the Favorite Venues section were removed afterwards (see `specs/dashboard-spec.md`). `GET /api/me/bookings/pending` and a comedian's cancelled-request cards are deliberately NOT filtered (their own history; the suspended venue's name stays visible).

No web changes: `venues/[id]` already shows "Venue not found." and `ComedianHomeContent` already falls back to an empty shows list on a non-OK response.

### Migration 023 (`023_legacy_booking_gate.sql`), applied and verified

`BEFORE INSERT` trigger `trg_bookings_venue_gate` on `bookings`: rejects (`42501`) unless `venue_is_public(shows.venue_id)`. A trigger, not an API check, because `book_show_spot` takes `p_comedian_id` and may be callable with the anon key; it also covers the direct-insert policy `bookings_insert_own`. Same no-JWT-claims exemption as 020 (SQL editor and seeding). Only INSERT is gated; existing legacy bookings are untouched (decided: gate only). Legacy bookings at the 9 hidden venues are now rejected too.

### Verified

API typecheck (only the 13 old errors remain), and against the running API with the real database: `/api/venues` returns exactly the 1 public venue (no hidden, no pending), `/api/venues/:id` returns 200 for the public venue and 404 for hidden and pending venues, `/api/shows` and `/api/spots` include no hidden or pending venue. **Not verified at that point:** anything involving a suspended venue (covered by the later live test below) and `favorite-venues` (never tested; the endpoint was removed afterwards).

**023, verified live (2026-10-15):** with the venue hidden, a comedian's `POST /api/shows/:id/book` is refused ("This venue is not taking bookings right now", returned by `book_show_spot` as `success:false` with HTTP 200, as the older routes do); with the venue public the booking succeeds; with the venue suspended a second booking is refused; the earlier booking stays untouched.

### Step 4b, part 3: handle_new_user, function lockdown, RLS (022b, 024, 025). Applied and verified live

Written from the user's real catalog output (2026-10-16), not from the repo's SQL. Applied by the user in this order: **022b, 024, 025** (025 depends on 022 and 022b because it trusts `users.role`). All three ran without error.

**Finding (the most serious one): anyone can sign up as admin.** The live `handle_new_user()` ran `COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'comedian')`. The metadata is whatever the client passes to `supabase.auth.signUp({ options: { data } })`, using the anon key that ships in the web bundle, so `data.role = 'admin'` created an admin row. 022 does not stop it (the auth service's transaction carries no client JWT claims, so 022 treats it as trusted). Checked on 2026-10-16: the only admins are the owner's account and the test admin, so it has not been used; not exploited by us either (the hole was read from the source, not demonstrated). The owner's own admin account was created through this same metadata route, so an admin is now made by promoting an existing account (service role or SQL editor).

| # | File | What it changes |
|---|---|---|
| 022b | `022b_handle_new_user_role_whitelist.sql` | Re-creates `handle_new_user` identical to the live version except the role: `venue_producer` is honoured (the web signup sends it), everything else including `admin`, missing or garbage becomes `comedian` (no cast error). |
| 024 | `024_lock_down_functions.sql` | Revokes `EXECUTE` from `PUBLIC, anon, authenticated` and grants to `service_role` on 14 functions: `book_show_spot, get_platform_stats, venue_confirm_booking, comedian_decline_booking, comedian_cancel_booking, apply_to_spot, comedian_cancel_spot_request, admin_hide_venue, admin_unhide_venue, venue_cancel_spot_request, create_show, update_show, cancel_show, accept_spot_request`. Explicit list (not a dynamic sweep) so nothing unreviewed is touched; `rls_auto_enable()` is a Supabase helper and is left alone. Aborts if any signature is wrong or the end state differs. |
| 025 | `025_tighten_public_rls.sql` | `venues_public_read` also requires `is_hidden = false AND is_suspended = false`; new `venues_admin_read_all` (inline `EXISTS` on `users.role` for `auth.uid()`); `shows_public_read` also requires the venue not hidden/suspended; `spots_public_read` and `venue_shows_public_read` now require an approved, active, not hidden, not suspended venue owned by the producer (inline, because the helper functions are not executable by anon). Includes an atomic self-test run as anon and as the admin. |

Evidence for 024 being safe (checked in the code): all 17 API `.rpc(` calls use `supabaseAdmin`; `apps/web` and `packages` have no `.rpc(`; no SQL function, trigger or policy in the repo calls any of the 14.
Evidence for 025 being safe: the API reads these tables with the anon client only on `/api/venues`, `/api/shows`, `/api/venues/:id` (venue + legacy shows) and `/api/spots` (venue ids), all of which already filter to public venues; spots/venue_shows are read with the service role. The web reads `venues` directly in signup (insert), login (owner's own venue, `venues_owner_read_own` is untouched) and `AdminProfile` (covered by the admin policy). The two duplicate insert policies on `venues` are left alone.
**Verified live after applying (2026-10-16, test accounts, real DB):**
- 022b: a signup with metadata role `admin` stored `comedian`; `venue_producer` stored `venue_producer`; a garbage role and no role stored `comedian`. The throwaway users were deleted. Admins are still only the owner's account and the test admin.
- 024: all 14 functions return `42501 permission denied` for the anon key and for logged-in comedian, owner and admin keys (called with their real argument names). The API flows that use them still work through the service role: create show, request a spot, accept, comedian cancel, legacy book, hide/unhide, `/api/admin/stats`.
- 025: with the anon key and with a plain comedian login, 2 of 12 venues are readable (exactly the public ones) and no hidden/suspended row or `suspension_reason` leaks. With the test venue flagged suspended and holding live spots, anon and comedian read 0 venues, 0 spots, 0 venue_shows and 0 legacy shows for it; its owner still reads their own; the test admin reads all 12 venues over a browser-style direct read (what `AdminProfile` does). Flag cleared afterwards and anon sees the venue and its shows again.
- Still **not** exercised in a browser: `AdminProfile` itself, owner banner, signup UI. Not touched: `POST /api/bookings/:id/confirm` (unauthenticated test helper, flagged below).

## Step 5: search and filters (Page A)

No migration. Backend plus UI, both on `/admin/venues`.

### API

`GET /api/admin/manage/venues` takes optional query params and now returns `{ venues, counts, cities }` (it used to return a bare array; the only consumer, `useAdminVenueList`, was updated):

| Param | Behavior |
|---|---|
| `q` | Venue **name only**, case-insensitive substring. Trimmed and silently **truncated to 100 characters** (not a 400). Never a SQL pattern, so `%` and `_` are plain characters. Address is not searched. |
| `status` | One of the six display statuses (`pending`, `changes_requested`, `approved`, `hidden`, `suspended`, `rejected`). Anything else is a 400. Empty means all. |
| `city` | Trimmed, case-insensitive exact match. |

- **Counts** (`all` plus the six statuses) follow `q` and `city` but **ignore `status`**, so the tiles stay a breakdown of the current search and the six always add up to `all`.
- **Cities** is the distinct, sorted list across **every** venue (the cities present in the data), not narrowed by any filter, so the dropdown does not shift while typing.
- Order is still `submitted_at` ascending. Still no address column.
- Filtering and counting happen **in memory** after loading the venues, because the display status is derived, not stored. It loads every venue per request: fine at hundreds of rows; move it into SQL if it grows to many thousands.

### One definition of "display status"

`deriveDisplayStatus` now lives in `packages/types/index.ts` and is imported by both `apps/api` (to filter and count) and `apps/web` (to render). `apps/web/src/lib/venueStatus.ts` re-exports it, so no call site changed; colors, labels, `statusReason` and `formatWaiting` stay there. No stored status column.

**This is `@repo/types`' first runtime export, which needed two config changes** (see `specs/decisions.md` for the full story):
- `apps/web/next.config.js`: `transpilePackages: ['@repo/types']`.
- `packages/types/package.json`: `"type": "module"`. Without it the ESM API crashes at startup ("does not provide an export named 'deriveDisplayStatus'"), even under `tsx` in dev; `next build` does not catch this. The function is defined directly in `index.ts` (a re-export from a sibling file failed the same way).
- **Known deployment trap:** `apps/api` has no tsconfig and its `build` script (`tsc`) does not work, so running the API as plain `node dist/index.js` would fail on the runtime import of a `.ts` package. Dev (`tsx`) is fine. Whoever deploys the API must add a build for it (or bundle it).

### Web

- `VenueFilterBar` (new, `components/admin/`): a `float-input` name search (placeholder "Search venues by name...", max 100, clear button) and a city `<select>` ("All cities" plus the API's list), stacked on mobile and in one row from `md`. The status filter is still the summary-strip tiles; `StatusSummaryStrip` was not changed (it already took `counts` as a prop).
- `useAdminVenueList(filters)`: sends the filters, returns `venues, counts, cities, isLoading, isFetching, error, refetch, reviewVenue`. `isLoading` is only the first load; afterwards the **previous list stays on screen** (dimmed, `aria-busy`) while a request runs. A request counter drops a response that arrives after a newer request was sent. `refetch` (after approve/reject) uses the **current** filters.
- Page: plain React state (no URL sync), search debounced 250 ms, status and city apply immediately. The "Needs your attention" / "Everything else" split stays while filtering. A selected city that disappears from the data falls back to "All cities".
- Empty states: no search/city matches shows "No venues match ..." with a **Clear filters** button instead of the two sections; with a search active the attention zone says "No pending venues match." and the list "No other venues match."; "No venues on the circuit yet." only when the database has none.

### Verified / not verified

Verified: `npm run check-types`, `next build`, ESLint on the changed web files, API typecheck (only the 13 old errors). **Live, against the real database with the test accounts: 62 checks passed, 0 failed** (script in the session scratchpad, not in the repo): role matrix (no/bogus token 401, comedian 403, owner 403, admin 200); response shape; counts invariants; each status, `q`, `city` and combinations checked against an oracle computed from the unfiltered list; `%`/`_` literal; address text not searchable; 150-character `q` truncated; no `address` key; TEST venues absent from `/api/venues`. Nine "TEST – " venues were created for this (pending, hidden pending, changes requested, rejected with and without a reason, hidden approved, suspended, a `100% _Wild` name, four cities) and **deleted afterwards**; the original 12 venues were not touched.

**Not verified:** the new UI in a browser (debounce feel, dimming, stale-response handling in practice, mobile layout, the empty states), and the page's behavior after approve/reject with filters active.

## Step 6a: Page B, read-only dossier and actions (`/admin/venues/[id]`)

Step 6 is delivered in three parts: **6a** (this section) the read-only dossier plus every action that needs no new UI; **6b** suspend / unsuspend (`SuspendVenueModal`, `ConfirmByTyping`); **6c** edit mode, `PhotoUrlListEditor` and the shared validator.

### Migration 026 (`026_hide_audit_and_state_checks.sql`)

**Applied by the user (2026-10-18) and verified live** (see below). The header lists three read-only queries for comparing the live function bodies with the repo first (022b showed they can differ).

- `venues.hidden_at`, `venues.hidden_by`. Venues hidden before 026 keep NULL; the UI says "time not recorded". Nothing is backfilled.
- `admin_hide_venue(uuid, text, uuid DEFAULT NULL)` and `admin_unhide_venue(uuid, uuid DEFAULT NULL)` replace the 008 versions. Hide records time and admin and refuses a repeat ("Venue is already hidden"); unhide clears the fields and refuses when not hidden. The old signatures are dropped; new ones are `service_role` only (024 listed the old ones).
- `venues_protect_moderation` is replaced with 018's body plus `hidden_at` / `hidden_by`, so an owner cannot forge them through PostgREST.
- **Visible change to the older `/home` routes** (`POST /api/venues/:id/hide|unhide`): a repeat hide or unhide now returns `{ success: false, error }` instead of silently succeeding (hiding twice used to send the owner a second notice). They still resolve through the defaulted `p_admin_id`.

### API (all under the `/api/admin` guard; address is never selected)

| Route | Notes |
|---|---|
| `GET /api/admin/manage/venues/:id` | `AdminVenueDetail` (`@repo/types`): all venue fields except address, owner name/email, and the names behind `reviewed_by`, `hidden_by`, `suspended_by`. Non-UUID or unknown id: 404. |
| `POST .../:id/reopen` | rejected -> pending via `admin_reopen_venue`. 409 for any other state. The venue goes to the back of the queue (`submitted_at` is reset). |
| `POST .../:id/hide` | `{ reason }` required (trimmed, <= 500). 409 if already hidden. |
| `POST .../:id/unhide` | 409 if not hidden. |

Hide and unhide are refused with 409 for a **suspended** venue ("lift the suspension first"). That check is a read in the route, not in the RPC, so the older routes keep their behavior. Approve / reject / request-changes are the existing step 3a routes.

### Web

- `app/admin/venues/[id]/page.tsx` under the existing admin guard layout: header (name, status badge, city, owner), **Situation** and **Next actions** side by side from `lg`, **Profile** below; one column on mobile in that order. Loading skeleton, "Venue not found" and retry states.
- **Situation** (`VenueSituationPanel`): display status, the current note in the italic style, and since-when / by-whom (pending shows "in the queue since"). A hide that is not the primary status shows as "Also hidden" with its own reason. It says outright that only the current note is kept (no history yet). **Flags only; counts belong to step 7.**
- **Next actions** (`VenueNextActions`): pending: Approve / Request changes / Reject; changes requested: Approve / Reject; rejected: Move back to pending; Hide or Unhide in every state except suspended. Approved has no Suspend yet and suspended has no Unsuspend yet (6b).
- **Profile** (`VenueProfilePanel`, read view only): name, city, description, photo URLs as text (first one labelled "Cover", no previews), Instagram, X, Maps (clickable only if they pass `safeHttpUrl`), contact email, contact phone. No Edit button until 6c.
- `ReviewActionModal` gained three kinds, `hide` (reason required, owner-visible), `unhide` and `reopen`; the existing three are unchanged. The action helper `src/lib/adminVenueActions.ts` is shared with the list hook (which lost its duplicate).
- Page A: the venue name in each row and review card now links to Page B. **Known limitation: Page A's filters are plain React state (step 5 decision), so coming back from a venue resets them.**

### Photo hosts: audit and a known gap (flagged, nothing changed)

- Planned for 6c: photo URLs are validated against an allowlist of hosts, mirrored in `next/image` `remotePatterns`: `picsum.photos`, `images.unsplash.com`, and this project's Supabase Storage host (`wfyqomxasthwdlpqttno.supabase.co`) restricted to `/storage/v1/object/public/**`. https only, at most 8, each at most 2048 characters. **Why:** `next.config.js` only allows `picsum.photos` today, and four components render `photos[0]` through `next/image`, so a URL on any other host would crash public pages for every comedian.
- **Audit of the 12 existing venues (read-only):** 10 have photos, 10 URLs in total. Nine are on `picsum.photos` (allowed). **One is not: "Pune Comedy Club" uses `http://localhost:3000/pune-comedy-club.jpeg`** (not https, not an allowed host; the file exists in `apps/web/public`). That venue is not public, so no comedian page is affected today. In 6c only changed fields are sent, so this value is not re-validated unless someone edits photos.
- **Known gap, read from the code and not exercised live:** the owner's `PATCH /api/venues/mine` and `/api/venues/:id` cannot save photos (not in `VENUE_EDITABLE_FIELDS`). But `venues_protect_moderation` does not cover `photos`, and the `venues_owner_update_own` / insert policies only check ownership, so an owner with their own JWT can probably write any URL to `photos` directly through PostgREST, which would break `next/image` on the public pages. It was not tested because the only public venue is the test venue and breaking it would affect the live pages. Decide whether to protect `photos` in the trigger (or validate in SQL) before the owner image feature.
- **Single source of truth (plan for 6c, to be verified first):** put the allowlist in a plain ESM file in `packages/types` (for example `photoHosts.js` with a `.d.ts`), importable by `next.config.js` (plain Node, cannot import `.ts`), the API and the web code, with the validator next to it so the later owner flow can call the same one. If importing it from `next.config.js` fails, two copies with a comment in each pointing at the other is the fallback.

### Deferred / known limitations (Step 6)

- Admin edits to a live venue do not notify the owner (decided: deferred).
- Unsaved-changes protection (6c) covers tab close or refresh and the page's own Cancel / Back links only, not clicks on the navbar or sidebar.

### Verified / not verified

Built and checked: `npm run check-types`, ESLint on the changed files, `next build` (lists `/admin/venues/[id]`), API typecheck (still only the 13 old errors).

**Verified live (2026-10-18, test accounts, real DB, migration 026 applied): 67 checks passed, 0 failed** (script in the session scratchpad, not in the repo). Role matrix on the four new routes (no token and bogus token 401, comedian 403, owner 403); detail: 404 for a non-UUID or unknown id, no `address` key, the raw `reviewed_by` / `hidden_by` / `suspended_by` ids are not exposed, owner name and email present; hide: reason required (blank, missing and 501 characters give 400), 409 on a repeat that leaves the first reason and time untouched, allowed on a pending venue (stays pending), 409 on a suspended one, `hidden_by_name` is the acting admin; unhide: clears all four fields, 409 when not hidden or suspended; reject then reopen: pending again, earlier note kept, `submitted_at` moved forward, reopen of a pending venue 409; owner notice: exactly one on hide and none on a refused repeat; an owner JWT cannot clear or reassign `hidden_at` / `hidden_by` through PostgREST; both new functions give 42501 for the anon key, an owner login and a comedian login; the older `/home` hide route still works and its repeat is now `success:false`; the step 5 list still returns 200 with counts that add up; no TEST venue is public. Fixtures were four "TEST – 6a" venues plus a brief hide of the shared test venue; all were removed or restored (venues back to 12, the test owner's notice deleted).

A test-fixture trap worth remembering: a venue inserted as `pending` with `is_active = false` is rewritten to `rejected` by the legacy sync trigger (018), so pending fixtures must keep `is_active = true`.

**Not verified: the page in a browser** (layout, the modals, the Page A links, mobile), and the Situation panel's wording for venues hidden before 026 ("time not recorded").

## Handoff: state and remaining work (steps 4-8)

Written at the end of the first session and refreshed at the end of the second so work can resume cold. The sections above are the record of what was built; this section is what to do next.

### Where things stand

| Step | Status |
|---|---|
| 0 lock unauthenticated admin endpoints | Built, reviewed. |
| 1a migration 018 (review status, suspension columns, RPCs, triggers) | **Applied** (user confirmed; backfill verified: 11 venues, all approved, 10 of them hidden). |
| 1b migration 019 (`accepted_at`, `cancelled_from_status` trigger) | **Applied** (user confirmed). |
| 2 admin guard, `/api/admin` prefix, Page A shell | Built. Server checks done; user reviewing visually. |
| 3a admin review actions (approve / reject / request changes) | Built; user confirmed Request changes works. |
| 3b owner status panel, Fix and resubmit, `PATCH /api/venues/mine`, spot gate | Built and committed. Migration 020 **applied** (user confirmed). Nothing in 3b has been exercised with real tokens or in a browser. |
| 4a suspend: migration 021, API, owner banner | **Built; 021 applied; API verified live with test accounts** (see "Step 4a"). Committed in `897c041`. Owner banner not yet checked in a browser. No admin UI (that is step 6). |
| 4b part 1: protect `users.role` (migration 022) | **Applied** (user confirmed). See "Step 4b, part 1". |
| 4b part 2: API public-path filters + migration 023 (legacy booking gate) | API built and verified against the real DB. **Migration 023 applied and verified live.** |
| 4b part 3: 022b (`handle_new_user` whitelist), 024 (function lockdown), 025 (RLS) | **Applied by the user and verified live; committed in `98e3537`.** See "Step 4b, part 3". **Step 4 is complete.** |
| 5 search and filters | **Built; API verified live (62 checks); UI not yet exercised in a browser.** See "Step 5". Uncommitted. |
| 6 Page B (dossier + edit) | **6a built** (read-only dossier, actions, migration 026 **applied**); API verified live (67 checks), UI not yet seen in a browser; 6b suspend UI and 6c edit not started. See "Step 6a". Uncommitted. |
| 7 stats | Not started. |
| 8 `/home` cleanup | Not started; must be LAST. |

Steps 0 to 3b are committed (`ac8a809`, which also swept in the user's `RequestsPanel.tsx`, `safeLinks.ts` and `specs/venue-dashboard.md`). Step 4a and 4b parts 1-2 are committed (`897c041`); 022b, 024, 025 and the spec updates after it are committed (`98e3537`). Step 5 is uncommitted (the user commits). Never stash, reset or check out uncommitted files (use `git diff` / `git show`, not stash).

### Session log

**Session 1:** steps 0 to 3b (migrations 018 to 020), committed in `ac8a809`.

**Session 2 (2026-10-14 to 2026-10-16):**
- Step 4a: suspend / unsuspend backend (migration 021, three admin routes) and the owner's suspended banner. Tested live with real tokens.
- Step 4b: closed three security holes, all applied and tested live. (1) A client could change its own `users.role` (022). (2) A signup could choose the `admin` role (022b, found by reading the live `handle_new_user`). (3) The anon key could run 14 older SECURITY DEFINER functions (024). Public API reads and direct database reads now hide hidden and suspended venues (API filters, 025). A `bookings` trigger blocks legacy bookings at non-public venues (023).
- Test accounts and a test venue were created in the real database (see Open items).
- Separate request, not part of the admin project: the Favorite Venues section on the comedian `/home` page was removed (component, `GET /api/me/favorite-venues`, the shared type; no database change). Recorded in `specs/dashboard-spec.md`; two stale sentences in this spec were updated.
- Commits: `897c041` holds 4a and 4b through 023. **Uncommitted at the end of session 2 (the working tree was clean at the start of session 3, so all of it has since been committed; 022b, 024, 025 are in `98e3537`):** migrations `022b`, `024`, `025`; the favourites removal (`index.ts`, `ComedianHomeContent.tsx`, the deleted `FavoriteVenuesSection.tsx`, `packages/types/index.ts`, `specs/dashboard-spec.md`); and this spec.

**Session 3:** step 5 (search and filters) built and verified live (see "Step 5"); decisions are logged in `specs/decisions.md`. **Next is step 6 (Page B).** Propose a plan first and wait for "go" (working rule 3). `git diff --stat` for a step should include `specs/decisions.md`.

### Working rules (the user's, from this session)

1. **Small, independently reviewable steps.** Build one step, show `git diff --stat`, update `specs/*.md` in the same step, then stop and wait. Do not start the next step without "go".
2. Before every Bash command give a one-line explanation of what it does and why (CLAUDE.md convention).
3. **Plan first, wait for approval** before any non-trivial new step; call out anything that deviates from the agreed plan (e.g. 019 as a trigger instead of rewriting four functions; the spot gate as triggers).
4. DB changes are **additive and backward compatible**; keep localStorage keys, existing DB values and identifiers. Migrations are applied manually by the user in the Supabase SQL editor (nothing can run Postgres locally, so SQL is unrun until the user applies it; say so every time).
5. Tests: `npm run check-types`, ESLint on changed files, plus a curl role matrix (no token, comedian, venue owner, admin) against every admin endpoint. **Test accounts now exist** (a test admin, venue owner and comedian plus an approved test venue, created in session 2; see the Open items below). Use the test admin for the admin half of the matrix and the others for the 403 half. Their credentials live outside the repo (never put them in a file that git can see). Report honestly what was and was not verified.
6. Design: dark glassmorphism using the global `.glass-panel` (the `/support` page is the blur/opacity reference); cyan `#38BDF8`; Bebas Neue headings and Cormorant Garamond italic voice (`font-[family-name:var(--font-cormorant)] italic`); **flat solid colors only: no gradients, no glow**; SVG icons only, no emojis; mobile-first; modals built on `ModalShell` (the Requests-modal chrome); buttons are `CtaButton`, inputs are `float-field`/`float-input` (no new button or input styles); no new dependencies or animation libraries. Status is always icon + label + color.
7. **No "verified" feature** anywhere (no flag, column or badge beyond the existing `verified` column that approve already set).
8. **Address is out of scope**: no editing, display, search or new logic anywhere, including admin edit and every new endpoint (do not `select` it in new code).
9. Do not touch comedian features, payments or user management.

### Environment notes

- Web dev server runs on :3000 and the API (`tsx watch`) on :8080, usually already running; the web proxies `/api/*` to the API. Check with `curl localhost:8080/api/health` before starting another.
- `apps/api` has no tsconfig, so Turbo's `check-types` skips it. Typecheck ad hoc: `cd apps/api && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck src/index.ts` and compare only the lines you changed: the file has old errors (the `req.params` `string | string[]` class and the pools-parser narrowing). I coerce with `String(req.params.id)` in new code.
- The shell is zsh: unquoted `$var` does not word-split. Use `${=var}` or arrays in loops (this broke a curl probe once).
- ESLint rejects directory arguments here; pass explicit file paths.
- `@repo/types` exports types plus **one runtime function**, `deriveDisplayStatus` (step 5). That is why the package is `"type": "module"` and `apps/web/next.config.js` has `transpilePackages: ['@repo/types']`; do not add further runtime exports without re-checking both the web build and that the API still starts (`next build` alone does not catch an API-side failure). The allowed-cities list still lives in the API (`VENUE_CITIES` in `apps/api/src/index.ts`) and clients read it from `GET /api/venues/mine/status`.
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

### Step 4: suspend (COMPLETE: 4a and 4b built, applied and verified; kept as the record of decisions)

**Decisions made when 4a was planned (do not re-ask):** suspend UI is NOT added to Page A (no row action menu); it ships with Page B in step 6 and 4a is tested by curl. Comedian-facing texts are the fixed neutral ones in Step 4a. Legacy System-1 is **gate only**: block `bookings` INSERT for a venue that is not public with a trigger (not an API check, because `book_show_spot` takes `p_comedian_id` and may be callable with the anon key); do not cancel existing legacy bookings. Hidden venues' `GET /api/venues/:id` returns 404 (9 of the 11 current venues are hidden and ownerless). The older `SECURITY DEFINER` functions get revoked from `PUBLIC, anon, authenticated` and granted to `service_role` in 4b; verified so far: nothing in `apps/web` or `packages` calls `.rpc()` and all 18 API `.rpc(` calls use `supabaseAdmin`. Before writing the revoke, get exact signatures from the user (`pg_proc` query in the SQL editor); apply nothing without their go. The "keep owner-only access to own venue" clause for `GET /api/venues/:id` has nothing to preserve: the route is unauthenticated and the owner dashboard uses `/api/venues/mine/status`.

Defaults approved: a show in progress counts as upcoming; one venue per owner assumed; a hidden venue can be suspended; unsuspend clears the suspension fields; a comedian's cancelled-request card still shows the suspended venue's name.

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

### Step 5: search and filters (Page A) (COMPLETE: built; see the "Step 5" section above for what shipped; kept as the original brief)

Server-side query params on `GET /api/admin/manage/venues`: `q` (venue **name only**, case-insensitive), `status` (one of the six display statuses; remember hidden = approved + hidden and suspended wins), `city`; keep the status strip counts correct (counts over the unfiltered set, or add a counts payload). UI: a `float-input` search field with a clear button (pattern in `ManageVenuesSection`) and a city control. **Do not reuse `FilterPills`** (spot-specific, has a glow shadow). Reuse the existing `<select>` styling the profile-edit page uses (or the `float-input` select used in `VenueDetailsModal`); do not invent new input styles. Keep the mobile card layout; add loading/empty states in the established voice.

### Step 6: Page B `/admin/venues/[id]` (the "dossier")

- **API:** `GET /api/admin/manage/venues/:id` (all venue fields **except address**, owner info, the three reasons with who/when via `reviewed_by`/`suspended_by` names); `PATCH /api/admin/manage/venues/:id` with the whitelist above, same validation as the owner path plus photos (https only, max 8, <= 2048 chars each; reuse one shared validator for owner and admin), city must be in `VENUE_CITIES` or unchanged; atomic and field-whitelisted, never touching `owner_id`, ids or moderation columns; `POST .../reopen` (rejected -> pending via `admin_reopen_venue`); approve/reject for a changes-requested venue via the existing endpoints; hide/unhide: reuse `POST /api/venues/:id/hide|unhide` (admin-guarded) or add manage-prefixed wrappers, keeping their behavior unchanged. Every action takes `p_admin_id` (audit log later plugs in with one INSERT per function; do not build the audit log now).
- **Web:** `app/admin/venues/[id]/page.tsx` under the existing guard layout. Dossier feel, not a form: (1) header (name in Bebas, city, owner, status badge); (2) a **Situation** panel (current status + its reason in the italic note + since when/by whom, plus hidden/suspended flags and counts); (3) a state-aware **Next actions** panel: pending -> Approve / Request changes / Reject; changes_requested -> Approve / Reject (waiting on owner); rejected -> Move back to pending; approved -> Hide or Unhide / Suspend; suspended -> Unsuspend; (4) **Profile** panel read view with an Edit toggle switching fields in place (name, city, description, photo URL list via a new `PhotoUrlListEditor`, Instagram, X, Maps, contact email, phone), Save/Cancel and an unsaved-changes warning; (5) the stats panel (step 7). Mobile: single column in that order. Link Page A rows and review cards to Page B (they are not linked yet). No address anywhere. Reasons history is only the current reasons until the audit-log task exists; say so in the UI copy/spec rather than inventing a timeline.
- **Suspend UI (moved here from step 4):** step 6 builds it, since 4a ships only the API. A `SuspendVenueModal` on `ModalShell` and a `ConfirmByTyping` component (a `float-input` that must equal the venue name before the danger `CtaButton` enables). The modal shows a "what will happen" block with live counts from `GET .../suspension-preview`, the plain statement that unsuspending will not restore anything, and a required reason (<= 500). Unsuspend is a plain confirm. The hook gains `getSuspensionPreview`, `suspendVenue` and `unsuspendVenue` against the three 4a routes. The Next actions panel launches them (approved -> Suspend; suspended -> Unsuspend).
- Reuse `StatusBadge`, `ReasonNote`, `ModalShell`, `ReviewActionModal`, `CtaButton`, `float-field`.

### Step 7: venue stats on Page B

`GET /api/admin/manage/venues/:id/stats` and a distinctive "pulse" panel (not four identical boxes): a large Bebas "requests received" figure, a flat stacked bar of outcomes (pending / accepted / waitlisted / cancelled) in the Requests-panel status colors (pending `#facc15`, accepted `#38bdf8`, waitlisted `#a1a1aa`), the acceptance rate as a flat SVG ring, plus spots created and cancellations (by venue / by comedian / after acceptance). Data: spots created = count of `venue_shows` for `venues.owner_id` (a show has up to 3 pool rows; show the number of shows, label it); requests received = `spot_requests` joined through `spots.venue_producer_id`; cancelled shows = `venue_shows.is_cancelled` (exact for all history). Acceptance rate and "cancelled after acceptance" follow the 019 rules in the Step 1b section; show a graceful italic "n/a" with a note ("recorded from <migration date>", and "n older requests excluded") rather than a proxy. Venues with a null `owner_id` show zeros/"no owner". The legacy `shows` table is not part of these stats.

### Step 8: `/home` cleanup (last, only after A and B are reviewed)

Replace the pending-approvals list and `ManageVenuesSection` in `AdminHomeContent` with a count tile linking to `/admin/venues` (pending count from `GET /api/admin/stats`, which now counts `review_status = 'pending'`). Then retire what nothing uses any more: `useAdminVenues`, `ManageVenuesSection`, `HideVenueDialog`, `VenueActionSheet`, `GET /api/admin/venues`, `GET /api/admin/pending-venues`, and the old unreasoned `POST /api/venues/:id/approve|reject` (this closes the known gap where `/home` can reject without a reason). Update `specs/admin-dashboard-spec.md` to point at this spec. Leave `AdminProfile` and the shared Sidebar alone.

### Open items and flags for the user

- ~~Older `SECURITY DEFINER` functions are not restricted~~ **Fixed by 024** (14 functions). Future functions get `EXECUTE` for PUBLIC by default, so each new migration must revoke explicitly (018, 021 do).
- `POST /api/bookings/:id/confirm` (a test helper) is unauthenticated. Out of scope; flagged.
- The signup trigger `handle_new_user` is still not in the repo as a base file; its current definition lives in `022b_handle_new_user_role_whitelist.sql`. The whitelist is verified live.
- **Test accounts exist in the real DB** (test admin, owner, comedian, and the approved, public venue "ZZ Claude Test Venue" with leftover shows/spots/a booking). Use the test admin for all admin testing (see memory `test-accounts`). They must be deleted when the project's testing is finished; until then the test venue appears in the real public venue list.
- Test states still not covered: rejected with and without reason, changes-requested, a second city, a venue with accepted/waitlisted requests (including the same comedian on two pools of one show) for the suspend test. Create them with the service role when step 5/6 needs them.
- Pending shows already created by pending venues: the count was never queried (it needs DB access). The query is in the conversation notes: join `venues` (unapproved) to `venue_shows`/`spots` on `owner_id = venue_producer_id`. Report the number if the user supplies it.
- Whether the owner-side "Fix and resubmit" and the admin flows behave end to end is **unverified** until the user tests with real accounts.

## Known limitations

- **`AdminProfile` "All Venues" list uses the old two-state Approved/Pending badge.** It predates the review and suspension states, so a suspended venue may appear there as "Approved", and unapproved venues of any kind show as "Pending". `/admin/venues` is the source of truth for venue status; this list is a known limitation until it is retired. It was intentionally left untouched.

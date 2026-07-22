# Admin Dashboard — Spec

**Status:** Ready for implementation
**Scope:** `/admin-dashboard` removal, admin `/home`, venue moderation (hide), venue producer notices
**Out of scope:** hard delete ("Remove Venue"), comedian `/profile` / `/profile/edit`, fan-card animation, venue producer's own show-management flows

---

## 1. Overview

`/admin-dashboard` is currently a placeholder route with no working functionality — all real admin tooling (venue approval, stats) lives on admin `/profile`, which was never meant to be the dashboard. This spec:

1. Deletes `/admin-dashboard`. `/home` becomes the admin's only dashboard route, matching the pattern already used for comedian and venue_producer roles.
2. Moves venue-approval (pending venues + accept) and two stats (total venues, pending approvals) from admin `/profile` to admin `/home`.
3. Adds a "Manage Venues" search + moderation surface to admin `/home`, with a **Hide Venue** action (soft delete only — see §5 for why "Remove Venue" is deferred).
4. Adds a minimal notices mechanism so a hidden venue's owner is told why, surfaced on their own `/home` dashboard (which currently has no reminders/notices concept at all).

---

## 2. Data Model

### 2.1 `venues` (existing table — new columns)

| Field | Type | Notes |
|---|---|---|
| is_hidden | boolean | default `false`. When `true`, excluded from comedian-facing `/api/venues` and `/api/shows` |
| hidden_reason | text, nullable | reason given by admin on last hide; cleared on unhide |

### 2.2 `venue_notices` (new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid, FK → users, `ON DELETE CASCADE` | recipient (venue owner) |
| venue_id | uuid, FK → venues, `ON DELETE SET NULL` | nullable so a notice can outlive its venue if hard-delete is added later |
| venue_name | text | snapshot at time of action, so the notice reads correctly even if venue_id becomes null later |
| reason | text | admin-supplied reason |
| created_at | timestamptz | default `now()` |

No `action` enum for now since only `hidden` exists — add one if/when "Remove Venue" ships.

**RLS:** owner can `SELECT` their own rows (`auth.uid() = owner_id`). No client-side INSERT/UPDATE/DELETE policies — all writes happen through `SECURITY DEFINER` functions invoked by the API's service-role client.

---

## 3. Functions (`SECURITY DEFINER`)

- `admin_hide_venue(p_venue_id uuid, p_reason text)` — sets `is_hidden = true`, `hidden_reason = p_reason`, inserts a `venue_notices` row snapshotting owner_id/venue_name. Returns `{ success, venue_id, owner_id }`.
- `admin_unhide_venue(p_venue_id uuid)` — sets `is_hidden = false`, `hidden_reason = NULL`. No notice inserted (unhide isn't punitive, doesn't need explaining).

Both follow the existing `admin_approve_venue` / `admin_reject_venue` pattern (plain `UPDATE ... RETURNING`, `NOT FOUND` → `{ success: false, error }`).

---

## 4. API (`apps/api/src/index.ts`)

New routes, all behind `requireUser` + `requireRole('admin')`:

- `GET /api/admin/venues` — full venue list (any approval/hidden status), for the Manage Venues search. Fields: `id, name, address, city, admin_approved, is_hidden, hidden_reason`.
- `POST /api/venues/:id/hide` — body `{ reason: string }`. Reason falls back to `"venue removed by admin"` server-side if blank. Calls `admin_hide_venue`.
- `POST /api/venues/:id/unhide` — calls `admin_unhide_venue`.

New route behind `requireUser` + `requireRole('venue_producer')`:

- `GET /api/venue-producer/notices` — own `venue_notices`, newest first.

**Existing venue query changes:**
- `GET /api/venues` and `GET /api/shows` (via the `venues!inner(...)` join) add `is_hidden = false` to their filters, alongside the existing `admin_approved = true, is_active = true`.

**Not touched in this pass:** `/api/admin/stats`, `/api/admin/pending-venues`, `/api/venues/:id/approve`, `/api/venues/:id/reject` remain unauthenticated, matching current behavior. (Pre-existing gap, flagged but explicitly out of scope per user decision.)

---

## 5. Why "Remove Venue" is deferred

The original ask included a hard-delete "Remove Venue" action. `shows.venue_id` and `bookings.show_id` both cascade-delete, so a hard delete would silently wipe a venue's show/booking history. Discussed with the user — decided to ship **Hide only** for now; hard delete (or a harder soft-delete state distinct from "hidden") can be added later once the desired semantics (does it block the owner from managing the venue? is it reversible?) are decided.

---

## 6. Frontend

### 6.1 Routing
- Delete `apps/web/app/admin-dashboard/` entirely.
- `apps/web/app/home/page.tsx` gains a branch: `user.role === 'admin'` → `<AdminHomeContent />` (currently admins fall through to `ComedianHomeContent` by accident).
- `apps/web/app/profile/page.tsx`: remove the "Admin Controls" sidebar nav item (pointed at the now-deleted `/admin-dashboard`).

### 6.2 `AdminHomeContent.tsx` (new — `src/components/dashboard/`)
Moved from `AdminProfile.tsx`:
- Two stat tiles: Total Venues, Pending Approvals (from `GET /api/admin/stats`)
- Pending Approvals list + Approve/Reject (existing `/api/venues/:id/approve` / `/reject`, unchanged)

New:
- **Manage Venues**: a search input, no list shown when empty. Fetches `GET /api/admin/venues` once (mirrors `/venues/page.tsx`'s "fetch once, filter client-side" approach) and live-filters by name/address using a helper extracted from that page's existing matching logic (moved to a shared location, e.g. `src/lib/venueSearch.ts`, so both pages call the same function instead of duplicating it).
- Clicking a result opens an action sheet: **Hide Venue** (and **Unhide Venue** if already hidden).
- Hide flow: confirm dialog "Are you sure you want to hide this venue?" + reason textarea, prefilled `"venue removed by admin"`, editable → `POST /api/venues/:id/hide`.

### 6.3 `AdminProfile.tsx`
Remove: Pending Approvals section, its state/handlers, and the two stat tiles being moved. Keep: profile header, remaining 2-stat row (Total Comedians, Total Bookings), All Venues list, By City block — untouched.

### 6.4 `VenueNoticesSection.tsx` (new — `src/components/venue-dashboard/`)
- New hook `useVenueNotices` (mirrors `useVenueSpots`'s shape) fetching `GET /api/venue-producer/notices` via `authorizedFetch`.
- Rendered in `VenueProducerDashboard.tsx`, styled like `RemindersSection`'s glass cards: venue name, reason, relative timestamp. Read-only — no actions.

---

## 7. Don't touch
Comedian `/profile`, `/profile/edit`, the fan-card animation, venue producer's own show-management flows (`AddSpotForm`, `RequestsPanel`, `CancelSpotDialog`, `VenueCalendarSection`).

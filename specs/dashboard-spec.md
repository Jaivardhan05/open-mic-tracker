# Spec: Comedian Home Dashboard (`/home`)

Scope: comedian role only. venue_producer and admin home views are explicitly
out of scope and must not be touched.

Three fixed-order sections: **Reminders/Confirmations → 7-Day Calendar →
Favorite Venues**. This pass wires real backend data for all three sections;
the only stubbed piece is payment (Stripe integration is a later project,
tracked separately).

A later pass (§6) wires the comedian-facing half of the booking loop itself:
"Book This Spot" on the venue sheet, and cancellation of a not-yet-confirmed
booking. Venue-producer-side confirmation UI remains out of scope — bookings
are moved into `confirmed_awaiting_comedian` only via the test/seed helper
(§3.5) until that UI exists.

## 1. Background — why a new column is needed

`bookings.payment_status` (`pending | confirmed | refunded | failed`) only
tracks payment state. The flow this dashboard needs — comedian applies →
venue producer confirms → comedian must then accept+pay or decline — has no
representation in the existing schema: there's no way to distinguish "venue
hasn't looked at this yet" from "venue confirmed, waiting on the comedian."
Overloading `payment_status` with confirmation states was considered and
rejected — it would conflate two independent concerns (has the venue signed
off vs. has money changed hands) and make future Stripe refund/failure states
harder to reason about.

## 2. New column: `bookings.booking_status`

Migration: `apps/api/src/db/migrations/002_booking_status.sql` (applied
manually, same as `001_comedian_profile_fields.sql`).

```sql
CREATE TYPE booking_status_enum AS ENUM (
  'awaiting_confirmation',
  'confirmed_awaiting_comedian',
  'confirmed_paid',
  'declined_by_comedian',
  'cancelled_by_comedian'
);

ALTER TABLE bookings
  ADD COLUMN booking_status booking_status_enum NOT NULL DEFAULT 'awaiting_confirmation';

CREATE INDEX idx_bookings_status ON bookings(booking_status);
```

`cancelled_by_comedian` was added in migration `003_comedian_cancel_booking.sql`
(`ALTER TYPE ... ADD VALUE`, applied as its own transaction — see §6). It is
kept distinct from `declined_by_comedian` even though both are comedian-
initiated exits, because they carry different meaning: cancelling happens
before the venue has acted on the booking at all, while declining happens
after the venue has already confirmed. Conflating them would make it
impossible to later tell "comedian changed their mind early" apart from
"comedian backed out after the venue committed" — e.g. for any future
no-show/reliability scoring — without a data migration to split them back
apart.

`payment_status` is untouched and stays payment-only.

### Status transitions

| From | To | Trigger | Who |
|---|---|---|---|
| — | `awaiting_confirmation` | `book_show_spot()` insert, called via `POST /api/shows/:id/book` | comedian books a spot |
| `awaiting_confirmation` | `confirmed_awaiting_comedian` | `venue_confirm_booking(p_booking_id)` | venue producer confirms (function added now; no venue-dashboard UI yet — out of scope for this pass) |
| `awaiting_confirmation` | `cancelled_by_comedian` | `comedian_cancel_booking(p_booking_id, p_comedian_id)` | comedian cancels before the venue has acted — atomically releases `slots_booked` back to `shows.available_spots` |
| `confirmed_awaiting_comedian` | `declined_by_comedian` | `comedian_decline_booking(p_booking_id, p_comedian_id)` | comedian declines after venue confirmation — atomically releases `slots_booked` back to `shows.available_spots` |
| `confirmed_awaiting_comedian` | `confirmed_paid` | **Not implemented this pass.** Requires real payment capture (Stripe). The "Accept & Pay" button in the UI is a frontend-only stub that shows a "Payment coming soon" state and does not call any transition endpoint. | — |

All new SQL functions are `SECURITY DEFINER`, following the same
atomic/row-locked pattern as `book_show_spot()` in `functions.sql`
(`FOR UPDATE` on the relevant row(s), explicit success/error JSON, no partial
writes). `comedian_cancel_booking` is a near-duplicate of
`comedian_decline_booking` with the status guard flipped to
`awaiting_confirmation` and the terminal state to `cancelled_by_comedian` —
kept as a separate function rather than parameterizing one function over both
transitions, since the two guard conditions must never be interchangeable
(the whole point of having two enum values is that a comedian can't decline
something the venue hasn't confirmed, or cancel something it already has).

## 3. Endpoints (`apps/api/src/index.ts`)

All comedian-facing endpoints below are gated by the existing `requireUser`
middleware and scoped to the authenticated user's own data — never
client-supplied IDs.

1. **`GET /api/me/bookings/pending`** — Reminders section data.
   Returns bookings for the authenticated comedian where
   `booking_status` is `awaiting_confirmation` **or**
   `confirmed_awaiting_comedian`, joined with show + venue info. Both
   pre-confirmation and post-confirmation pending states share this one
   query/section — the frontend distinguishes them by status (§5).

2. **`POST /api/bookings/:id/decline`** — Decline action.
   Calls `comedian_decline_booking(p_booking_id, p_comedian_id)` via
   `supabaseAdmin.rpc`. Fully functional: releases the spot, updates status,
   returns the RPC's success/error JSON. Only valid on
   `confirmed_awaiting_comedian` bookings — the RPC rejects anything else.

3. **`GET /api/me/bookings/upcoming?days=7`** — Calendar section data.
   Bookings for the authenticated comedian whose show `date` falls within
   `[today, today + 6]` inclusive, excluding `declined_by_comedian` and
   `cancelled_by_comedian`, joined with show + venue info. `days` defaults to
   7; not exposed in the UI yet but kept as a query param for future reuse.

4. **`GET /api/me/favorite-venues`** — Favorites section data.
   Groups the comedian's bookings (excluding `declined_by_comedian` and
   `cancelled_by_comedian`) by `venue_id`, counts them, returns the
   **top 3 venues by booking count**, ties broken by most recent booking. No
   minimum-count threshold — a venue booked even once qualifies as long as
   it's within the top 3. Returns `[]` if the comedian has zero bookings.
   Aggregation happens in application code (Node), not SQL, since PostgREST
   doesn't support `GROUP BY` aggregates through the JS client — consistent
   with the existing owner-lookup pattern in `GET /api/admin/pending-venues`.

5. **`POST /api/bookings/:id/confirm`** — test/seed helper only.
   Calls `venue_confirm_booking(p_booking_id)`. No auth gate, mirroring the
   existing (also ungated) `/api/venues/:id/approve` admin endpoint. Exists
   so `confirmed_awaiting_comedian` bookings can be produced for manual
   testing until the real venue-dashboard confirm UI is built (separate,
   future scope).

6. **`POST /api/shows/:id/book`** — Book a spot. Calls
   `book_show_spot(p_show_id, p_comedian_id, p_slots)` via
   `supabaseAdmin.rpc`, defaulting `p_slots` to 1. `:id` is the show id, not
   a booking id. Row-locked and validated in SQL (capacity, cancellation,
   past-date checks) — see `functions.sql`.

7. **`POST /api/bookings/:id/cancel`** — Cancel action, for bookings still
   in `awaiting_confirmation`. Calls
   `comedian_cancel_booking(p_booking_id, p_comedian_id)` via
   `supabaseAdmin.rpc`. Releases the spot, sets `cancelled_by_comedian`,
   returns the RPC's success/error JSON. Distinct endpoint from
   `/decline` because the two RPCs guard different source statuses (§2).

## 4. Favorite-venue rule (confirmed)

- Rank distinct venues the comedian has booked (any booking not
  `declined_by_comedian` or `cancelled_by_comedian`) by booking count,
  descending.
- Take the top 3.
- If the comedian has booked 1 or 2 distinct venues, show just those.
- If 0 bookings exist, the section still renders, with the empty-state copy
  "Book more shows to see your favorite venues here." (see §5 — sections must
  never be hidden).
- No minimum "routine" threshold — one booking is enough to appear, subject
  to the top-3 cap.

## 5. Frontend (`apps/web/app/home/page.tsx`)

Minimal/placeholder visual treatment only — reuses existing `content-glass`
card styling and the `#38bdf8` cyan accent already used elsewhere
(`venue-dashboard`, `profile`). No new design system, no polish pass.

**All three sections always render**, in fixed order
Reminders → Calendar → Favorite Venues, even with zero data. Each has a
`content-glass` empty-state line instead of being omitted, so the page never
looks broken/unimplemented when a comedian has no bookings yet.

- **Reminders** (top): one card per booking in `awaiting_confirmation` or
  `confirmed_awaiting_comedian` — venue name, show date/time, charge. Actions
  branch on status:
  - `awaiting_confirmation` — a "Waiting for confirmation" badge and a single
    **Cancel** action, calling `POST /api/bookings/:id/cancel`.
  - `confirmed_awaiting_comedian` — the existing pair:
    - **Accept & Pay** — stub button, shows an inline "Payment coming soon"
      state on click. Does not call any API.
    - **Decline** — calls `POST /api/bookings/:id/decline`; on success,
      removes the card from the list.
  - Empty state: "No pending confirmations."
- **7-Day Calendar** (middle): a 7-column grid (today + next 6 days), one
  column per day with a weekday/date header and stacked chip(s) below for
  that day's booked shows. Built as a plain Tailwind grid — no calendar
  library — since the actual need (a 7-cell day strip with chip content) is
  simpler than what a full calendar package provides, and this UI is
  explicitly temporary pending a real design pass. Empty days render as a
  blank column (header only, no chips). Two visual states via chip color:
  `confirmed_paid` (cyan border/fill, `#38bdf8`) vs.
  `awaiting_confirmation` / `confirmed_awaiting_comedian` (muted zinc
  outline). Today's column gets a subtle cyan-tinted border to distinguish
  it from the rest. Not the final calendar UI — will be replaced in a future
  design pass.
- **Favorite Venues** (bottom): up to 3 venue cards. Empty state: "Book more
  shows to see your favorite venues here."

Scoped to the comedian home page only. `venue_producer`/`admin` routes are
untouched.

## 6. Comedian-facing booking loop (venue sheet ↔ Reminders)

Verifies the core loop end-to-end from the comedian's side: Book Spot → show
a pending state → allow cancellation until the venue confirms. Venue-producer
confirmation UI is out of scope for this pass (see §3.5 for the test/seed
workaround).

**"Book This Spot"** exists on two surfaces, both wired to
`POST /api/shows/:id/book`:
- `apps/web/src/components/VenueDetailSheet.tsx` (per show, rendered from
  `/home`'s venue grid) — previously a `console.log` no-op. On success, that
  show's button is replaced by one of two states, based on whether the
  comedian already has an active booking on it:
  - `awaiting_confirmation` — "Waiting for confirmation" badge + **Cancel**
    button, calling `POST /api/bookings/:id/cancel`.
  - `confirmed_awaiting_comedian` — a note pointing to the Reminders section
    ("Confirmed by venue — respond in Reminders & Confirmations"); no action
    button here, since Accept & Pay / Decline live only in Reminders to avoid
    duplicating that control surface.
- `apps/web/app/venues/[id]/page.tsx` ("Book Spot", per show) — this is the
  page comedians actually reach via Sidebar → All Venues → a venue card;
  `/home`'s own venue grid isn't populated by anything in the current UI, so
  `VenueDetailSheet` above is not yet reachable through normal navigation.
  Wired to the same `bookSpot` from `useComedianBookings`; on success the
  button is replaced with a static "Waiting for confirmation" label (no
  Cancel action on this surface yet — deferred, along with any venue-side
  affirmation UI, to a later pass). Prevents rebooking the same show once a
  booking is pending.

**State sync**: `VenueDetailSheet` and `RemindersSection` render
simultaneously on the same `/home` page (the sheet opens over the dashboard),
so this is same-page state sync, not cross-page. Rather than each component
independently fetching its own copy of booking data, a shared hook —
`apps/web/src/hooks/useComedianBookings.ts` — is owned by
`apps/web/app/home/page.tsx` and passed down as props (`bookings`,
`bookSpot`, `cancelBooking`, `declineBooking`) to both components. A single
fetch of `GET /api/me/bookings/pending` (already loosened in §3.1 to include
both pending statuses) is the one source of truth; cancelling or declining
from either surface updates the shared array (optimistic local removal by id
on success) so both views reflect it immediately without a second round
trip. Booking a new spot triggers one `refetch()` of that same endpoint,
since the RPC response doesn't carry the full joined show/venue shape the UI
needs. `page.tsx` additionally re-fetches the open venue's shows
(`GET /api/venues/:id`) after a successful book/cancel from the sheet, so
`available_spots` stays accurate without closing and reopening the sheet.

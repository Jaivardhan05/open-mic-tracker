# Venue Producer Dashboard — Spec

**Status:** Ready for implementation
**Scope:** venue_producer dashboard — calendar, spot creation, request management, cancellation
**Out of scope:** payments, recurring spots, editing spot details post-creation, comedian-side calendar redesign (beyond the reminders-window status update described in §6)

---

## 1. Overview

Venue producers currently have a stubbed dashboard. This spec adds:

1. A calendar showing the venue producer's own spots.
2. An "Add a new Spot" flow.
3. A request-management panel: accept requests, automatic waitlisting, promote from waitlist, cancel a spot.
4. Comedian-side surfacing of accept/waitlist/cancel status in their existing reminders window.

This replaces the old "book instantly" assumption from the original requirements doc. Booking is now a **request → accept** flow. No reject action exists — overflow is handled automatically via waitlist.

---

## 2. Data Model

### 2.1 `spots` (new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| venue_producer_id | uuid, FK → users | owner of the spot |
| date | date | |
| start_time | time | |
| end_time | time | |
| spot_type | enum: `busking`, `non_busking` | |
| total_spots | integer | set at creation, immutable |
| available_spots | integer | starts = total_spots; decremented on accept, incremented on comedian-cancel |
| price | decimal, nullable | `null` or `0` = Free |
| is_cancelled | boolean | default `false` |
| cancellation_message | text, nullable | defaults to `"Spot canceled by venue"` if venue owner leaves it blank |
| created_at | timestamp | |

### 2.2 `spot_requests` (new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| spot_id | uuid, FK → spots | |
| comedian_id | uuid, FK → users | |
| status | enum: `pending`, `accepted`, `waitlisted`, `cancelled_by_comedian`, `cancelled_by_venue` | |
| venue_message | text, nullable | attached when venue owner accepts (optional note) |
| requested_at | timestamp | |
| decided_at | timestamp, nullable | set when status moves off `pending`/`waitlisted` |

**Constraint:** one `(spot_id, comedian_id)` pair should be unique for any *active* request (pending/accepted/waitlisted) — a comedian shouldn't be able to submit duplicate requests to the same spot. Not enforced for cancelled rows (history is kept).

---

## 3. State Machinecomedian applies
→ spot_request created as pending

venue owner accepts a pending request
→ that request → accepted
→ spots.available_spots -= 1
→ optional venue_message stored
→ IF available_spots == 0:
all other pending requests on this spot → waitlisted (automatic, no manual reject)

comedian cancels an accepted request
→ request → cancelled_by_comedian
→ spots.available_spots += 1
→ spot becomes eligible for promotion (see below)

venue owner promotes a waitlisted request (only enabled if available_spots > 0)
→ request → accepted
→ spots.available_spots -= 1
→ optional venue_message stored

venue owner cancels the whole spot
→ spots.is_cancelled = true
→ spots.cancellation_message = provided text OR "Spot canceled by venue"
→ ALL spot_requests on this spot (any status) → cancelled_by_venue
→ each cancelled_by_venue request inherits spots.cancellation_message
→ spot can no longer accept new requests, promotions, or be un-cancelled
No reject action exists in this version. No edit-after-creation for spot details (date/time/type/price) — only cancellation.

---

## 4. API Endpoints (`apps/api`)

All routes authenticated; role-guarded to `venue_producer` unless noted. Follow the existing server-side whitelist pattern (no raw client Supabase writes for mutations).

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/spots` | Create a spot (date, start_time, end_time, spot_type, total_spots, price) |
| GET | `/api/spots/mine` | List venue producer's own spots (for calendar) |
| POST | `/api/spots/:id/cancel` | Cancel a spot; body: `{ message?: string }` |
| GET | `/api/spots/:id/requests` | List all requests for a spot, grouped by status |
| POST | `/api/spot-requests` | Comedian applies to a spot; body: `{ spot_id }`. Role-guarded to `comedian`. |
| POST | `/api/spot-requests/:id/accept` | Venue owner accepts a pending or promotes a waitlisted request; body: `{ message?: string }` |
| POST | `/api/spot-requests/:id/cancel` | Comedian cancels their own accepted request. Role-guarded to `comedian`; ownership check required (comedian can only cancel their own request). |
| GET | `/api/spot-requests/mine` | Comedian's own requests across all spots (for reminders window) |

**Security notes:**
- `accept`/`cancel` on spots must verify `venue_producer_id` matches the authenticated user — a venue owner must not be able to act on another venue owner's spot.
- The comedian-cancel endpoint must verify the request belongs to the requesting comedian.
- `available_spots` decrement/increment must happen inside a transaction (mirrors the atomic pattern from the original architecture doc) to avoid race conditions if two accepts happen concurrently.

---

## 5. Venue Producer Dashboard UI

### 5.1 "Your Spots" list
Implemented as a sorted (date, then start_time) list of cards
(`VenueSpotsListSection.tsx` + `VenueSpotCard.tsx`), not a date-grid
calendar — the date-cell calendar described in earlier drafts of this spec
was never built; this is the actual shipped surface and is the one this
subsection now documents.

**2026-08-13 redesign.** The original version was a plain `content-glass`
row with strikethrough text for cancelled spots and no status signal beyond
that. Replaced with a card that treats status as a first-class visual
element instead of a text decoration:

- **Status spine** — a 5px vertical bar on the card's left edge is the
  primary status read, independent of the text inside:
  - Cancelled: a repeating diagonal hazard stripe (red/black,
    `repeating-linear-gradient`) — the same visual grammar as physical
    "closed" tape, chosen so cancellation reads instantly without relying
    on strikethrough or grey-out (which is easy to mistake for "loading"
    or "disabled" rather than "this booking fell through").
  - Active, spots still open: flat cyan (`#38bdf8`), matching the site's
    one accent color.
  - Active, last 1–2 spots open: flat amber (`#facc15`) — same "filling up"
    urgency color already used for `pending` status in the comedian-side
    `SpotRequestCard`.
  - Active, full: flat cyan, unchanged (fullness is communicated by the
    capacity meter, not a color change — a sold-out spot isn't an error
    state).
- **Capacity meter** — spots filled vs total is shown as a row of
  small flat blocks (segmented meter), one per total spot, filled blocks
  solid and open blocks outlined — not a percentage bar or a gradient
  progress bar. This is the "real stakes" detail: a stage manager reading
  the list at a glance sees exactly which shows are close to full, not
  just a fraction buried in text. Falls back to a single proportional bar
  above ~12 total spots to avoid clutter. The `n/total` text label is kept
  alongside it (not replaced) since the meter is a supplement, not a
  substitute, for the exact number.
  - **Filled count semantics**: `total_spots - available_spots` (the
    original list rendered raw `available_spots` under the "spots" label,
    which is the *remaining* count, not filled — e.g. a full spot showed
    "0/4" instead of "4/4". Fixed as part of this pass; no API/data model
    change, `available_spots` still means what it always meant server-side).
- **Cancelled cards** — no strikethrough anywhere. Instead:
  - The hazard-stripe spine (above).
  - A small angular "CANCELLED" corner tag (clip-path polygon, same
    technique as the price/availability corner badges on
    `VenueListCard.tsx` — flat dark fill, no pill, no gradient).
  - The cancellation reason (custom or the server default `"Spot canceled
    by venue"`) shown as its own labelled row below a dashed divider,
    in place of the action row — not greyed inline text.
  - Date/time/fee/type text stays fully legible (not dimmed to
    near-illegible grey) — a cancelled show is still information the
    venue owner needs to read clearly, just tagged as no longer live.
- **Actions** — "View Requests" / "Cancel" (active spots only) now use the
  shared `CtaButton` component (the same underline+arrow control used
  everywhere else on the site, e.g. `SpotRequestCard`'s "View Venue" /
  "Cancel Spot"), each wrapped in `min-h-[44px]` per the tap-target rule
  established in the mobile-fix pass — replacing the old raw
  `<button className="rounded-lg border ...">` pair.
- Typography: date in `--font-bebas` (matches the site's display-numeral
  convention elsewhere), date formatted as `D Mon, YYYY` (e.g. "7 Jul,
  2026"); time range in 12-hour lowercase am/pm (e.g. "7:00 pm – 8:00
  pm").
- **Auto-hide rule (2026-08-13):** `GET /api/spots/mine` excludes a spot
  when `is_cancelled = true` AND its `date` has already passed (i.e. is
  before today). This is unrelated to, and not replaced by, the comedian-side
  `spot-requests/mine` 24h-after-cancellation cutoff described in §6 — that
  rule lives on a different table (`spot_requests`, keyed off `decided_at`)
  and endpoint entirely; the two never applied to this list and don't
  conflict here (no such 24h rule was ever implemented for `spots/mine` —
  confirmed by inspection before this change). Active (non-cancelled) spots
  are unaffected and keep showing regardless of date, as before — no
  date-passed filter exists or was added for them, since none was requested.
  A spot cancelled on the same day it was scheduled still shows until that
  date rolls over, same as any other cancelled spot.

### 5.2 "Add a new Spot" button + form
Fields:
- Date
- Start time / End time
- Total spots available (integer)
- Type: Busking / Non-Busking (toggle)
- Price: Free or ₹ amount

On submit → `POST /api/spots`. Form closes and calendar/list refreshes.

### 5.3 Requests panel
Grouped per spot, three sections:
1. **Pending** — each request has an **Accept** action, with an optional short message field.
2. **Accepted** — read-only list of who's confirmed.
3. **Waitlisted** — shown only when relevant; each has a **Promote** action, enabled only once `available_spots > 0` for that spot (i.e. after a cancellation frees a slot).

**2026-08-13 redesign.** The original panel used the base `content-glass`
tier for both the modal itself and the nested per-request card inside it —
same background/blur on both layers, so the panel barely separated from
the dashboard behind it and the nested card was invisible against its own
parent. Fixed as two distinct elevation levels instead of one flat glass
tier repeated twice:

- **Panel (modal chrome)** — bumped from the base `content-glass` tier
  (`rgba(0,0,0,0.52)`, `blur(24px)`) to the same treatment
  `navbar-glass`/`sidebar-glass` already use for chrome that must stay
  legible over page content: `rgba(5,10,35,0.90)` background,
  `blur(40px) saturate(120%)`. This is a level above the `blur(40px)`
  content-card tier used on `/support`/`/venues` and the spot cards
  (§5.1) — deliberately, since a modal sits in front of an entire
  dashboard (navbar, hero, cards) rather than in front of a single
  background image, and needed the stronger of the site's two existing
  glass conventions, not a third new one.
- **Nested request card** — no longer a second glass layer (blur-on-blur
  reads as no boundary at all). Now a solid, unblurred fill
  (`rgba(0,0,0,0.55)`) with its own border, so it's legible as a distinct
  object sitting inside the panel rather than a continuation of it.
- **Status identity** — each request card carries a left status spine,
  reusing the spine idiom introduced in the spot-card redesign (§5.1)
  rather than inventing a new convention: amber for pending, cyan for
  accepted, neutral zinc for waitlisted. Section headings get a matching
  colored accent bar (same left-bar technique as `/support`'s
  `.section-heading`) so Pending/Accepted/Waitlisted read as distinct
  zones at a glance, not one plain stacked list. Section copy (`"Pending
  (0)"`, `"Accepted (1)"`, empty-state text) is unchanged — only its
  typography and the accent bar are new.
- **Close control** — swapped the literal `✕` text glyph for the existing
  `IconClose` SVG (`components/icons/NavIcons.tsx`), consistent with the
  "SVG icons only" rule already applied elsewhere.
- **Tap targets** — Accept/Cancel/Promote buttons, the message input, and
  the close control are all raised to a 44px minimum (they were
  `py-1`/`py-1.5`-scale controls before, well under the site's tap-target
  rule).

**2026-08-13 follow-up.** The first pass above fixed the blur tier but two
problems remained on inspection: the `rgba(5,10,35,0.90)` navy panel still
read as part of the page behind it (the page's own background photo/overlay
is similarly dark-navy-toned, so a same-hue panel doesn't separate no matter
how opaque), and the nested request card's flat black fill + left accent bar
looked like a generic placeholder box, not something designed around "a
comedian's request for a spot." A positioning bug was also found: the modal
centered against the full viewport, so it visually overlapped the fixed
navbar/sidebar instead of sitting inside the dashboard's own content frame.
Fixed as follows (heading style, section-label markers, typography, text
colors, Cancel button styling, and the message input were explicitly left
untouched):

- **Panel surface — luminance-based elevation, not just opacity.** Dark-UI
  elevation is conventionally done by making higher surfaces *lighter*, not
  by adding shadow (a shadow needs contrast against something lighter than
  itself to read, which a near-black page doesn't offer) — see
  [Fluent 2's elevation model](https://fluent2.microsoft.design/elevation)
  and [Uxcel's guide to dark-UI elevation](https://uxcel.com/blog/mastering-elevation-for-dark-ui-a-comprehensive-guide-342),
  both of which stack surfaces by lightening luminance per level rather than
  darkening/shadowing. Applied here: the panel moved off the page's own
  navy hue entirely, to a neutral `rgba(24,24,27,0.94)` (zinc-900) —
  distinct in *hue*, not just opacity, from the navy-toned page background
  behind it — at `blur(40px) saturate(140%)`. A 1px inset top highlight
  (`inset 0 1px 0 rgba(255,255,255,0.06)`) stands in for the "catch a bit of
  light on the top edge" cue real elevated glass has, paired with a soft
  black drop shadow (`0 24px 64px -12px rgba(0,0,0,0.65)`) to lift it off
  the page — a directional soft shadow, not a colored/neon glow, so it stays
  within the "no neon glow" rule.
- **Nested request card — its own surface, not a smaller copy of the
  panel.** Dropped the flat `rgba(0,0,0,0.55)` fill + left accent bar
  (read as a generic nested box) for: a *lighter* fill than the panel
  (`rgba(255,255,255,0.045)` — the next luminance step up, per the same
  elevation model above) with a plain border, sharp corners (no
  `border-radius`, breaking from the rounded-2xl/rounded-xl treatment used
  everywhere else in the panel and on the spot cards) so it reads
  deliberately as its own cut object rather than another rounded card, and
  a dashed divider — tinted per-status (amber/cyan/zinc, same values as the
  section markers) — separating the requester's identity (name + timestamp
  + note) from the action zone (message input + button). The dashed,
  colored divider stands in for a ticket's tear/perforation line — a detail
  specific to "a request for a spot" rather than a generic list-item
  pattern, and replaces the old spine as the per-card status cue (the
  section heading's marker already carries group-level status, so the card
  no longer needed to repeat it as a full-height bar).
- **Centering fixed to the content frame, not the viewport.** The overlay
  wrapper was `fixed inset-0`, so it centered against and dimmed the entire
  viewport including the fixed navbar (`h-14`) and sidebar
  (`var(--sidebar-w)`, `lg:` and up). Changed to
  `fixed inset-x-0 bottom-0 top-14 lg:left-[var(--sidebar-w)]` — the exact
  offsets `app/home/page.tsx`'s own `<main>` element already uses for the
  dashboard's content frame — so the modal (and its dimming scrim) is
  centered within, and confined to, that frame and never visually competes
  with the fixed chrome above/beside it.
- Available per spot (from the calendar or the requests panel).
- Opens a confirmation with an optional message textarea.
- On confirm with no message entered → stored message defaults to `"Spot canceled by venue"`.
- No un-cancel action.

---

## 6. Comedian-Side Changes (minimal, scoped)

The comedian's reminders window (`SpotRequestCard` inside `RemindersSection`, part
of the Reminders & Confirmations section on `/home`) shows one ticket-stub style
card per applied spot request, redesigned to a two-part layout: a main stub
(venue name as the primary focal point, date/time/type, actions) and a
perforated status stub showing the current state. No glow/text-shadow on any
card text — the outer glass panel is the only glassmorphism layer.

- `pending` → shows a "Waiting for Confirmation" state. Comedian can trigger
  `cancel` on this request from this same view.
- `accepted` → shows accepted state, plus venue owner's optional message if
  present. Comedian can trigger `cancel` here too.
- `waitlisted` → shows waitlisted state. No cancel action.
- `cancelled_by_venue` → shows cancellation state + the cancellation message
  (custom or default `"Spot canceled by venue"`). No cancel action. **Drops
  out of `GET /api/spot-requests/mine` 24 hours after cancellation** — the
  endpoint filters out `cancelled_by_venue` rows whose `decided_at` is older
  than 24h. No new column was added for this: `decided_at` is overwritten on
  every status transition (see §5.2/§5.3 functions), so for a row currently
  at `cancelled_by_venue` it already holds the cancellation timestamp.

Explicitly out of scope: redesigning the comedian calendar/reminders window
layout as a whole (only the spot-request card itself), and the legacy
`bookings`-based reminder cards in the same section (unchanged).

---

## 7. Explicitly Deferred

- Payments (per existing phase plan).
- Editing a spot's date/time/type/price after creation.
- Manual reject action (superseded by auto-waitlist).
- Un-cancelling a spot.
- Push/email/SMS notifications — status changes surface only in-app, in the reminders window.
- Recurring/repeating spot creation.

---

## 8. Implementation Order (suggested)

1. `spots` + `spot_requests` tables + migrations, seeded with mock data.
2. API endpoints, with the transaction-safe accept/promote/cancel logic.
3. Venue producer dashboard: calendar (read from `/spots/mine`), Add Spot form, requests panel.
4. Comedian reminders-window update to surface status + message.
5. Manual end-to-end test: create spot → 2 comedians apply → accept 1 (fills spot) → confirm 2nd auto-waitlists → cancel accepted comedian → confirm promote becomes available → cancel whole spot → confirm both comedians show cancellation state.
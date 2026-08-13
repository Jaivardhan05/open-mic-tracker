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

**2026-08-14 follow-up.** The previous pass explicitly left three things
untouched: the panel/card surfaces stayed flat single-rgba fills once
separated by hue, the Cancel button on an accepted request predated the
site-wide `CtaButton` redesign, and the message input used a boxed style
instead of the underline floating-label pattern from `/auth`. All three
addressed here, without touching modal positioning, section heading style,
section-label markers, typography, or text colors:

- **Panel and nested card — texture/depth added on top of the existing
  luminance-elevation model, not a replacement for it.** Both surfaces keep
  their established base fill (`rgba(24,24,27,0.94)` panel /
  `rgba(255,255,255,0.045)` card) and hue — only their flatness is
  addressed:
  - **Panel** gets a faint top-down radial highlight (~4% white, sheen
    rather than a visible gradient) layered under the flat fill, a subtle
    SVG-grain texture overlay (`feTurbulence`, ~3% opacity) for tactile
    depth, and a gradient border (brighter top edge fading to dimmer
    sides/bottom) replacing the flat `white/[0.14]` border — mimicking an
    edge-lit pane of glass catching light from above.
  - **Nested request card** gets a subtle top-to-bottom gradient fill
    (marginally lighter at the top edge, fading to the existing base rgba)
    so it reads as a physical object catching light rather than a flat
    tint, plus the same grain texture as the panel for material
    consistency between the two surfaces. Sharp corners, the dashed
    per-status divider, and all text/label colors are unchanged.
  - Both additions are luminance/texture only — no hue shift, no colored
    glow, consistent with the "no neon glow" rule already established for
    this panel.
- **Cancel button (Accepted section) — moved onto `CtaButton`.** The
  hand-rolled `border-red-800 bg-red-900/40` button is replaced by the
  shared `CtaButton` component used everywhere else on the site, given a
  new `variant="danger"` prop. `CtaButton` previously only rendered in its
  default cyan (`#38bdf8`); the danger variant recolors the label, the
  underline-on-hover bar, and the arrow icon to `#f87171` (red-400) —
  matching the red already used for this panel's own error banner, rather
  than introducing a second red. Motion (underline sweep, arrow slide-in on
  hover) is identical to the default variant; only color changes.
- **Message input — moved onto the `/auth` underline floating-label
  pattern.** The boxed `rounded-lg border bg-black/30` input is replaced
  with the same floating-label structure `/auth` uses (`floatField` /
  `floatInput` / `floatLabel` / `floatBar`). Since `/auth`'s version lives
  scoped inside `auth.module.css`, the pattern is lifted into `globals.css`
  as shared `.float-field` / `.float-input` / `.float-label` / `.float-bar`
  classes — the same place the shared `.cta` button classes already live —
  so both `/auth` and this panel (and any future usage) draw from one
  definition instead of duplicating it. Visual behavior (label floats up
  and shrinks on focus/filled, bottom bar sweeps in on focus, cyan accent)
  is unchanged from `/auth`.

**2026-08-14 second follow-up.** Two smaller fixes on top of the above:

- **Panel/card surface tint — cyan instead of colorless.** The gradient
  border and radial sheen added on the panel in the prior pass used plain
  white (`rgba(255,255,255,…)`), which read as neutral grey rather than
  part of the site's blue theme. Both are now tinted with the site's cyan
  accent (`#38bdf8`) instead — same layers, same opacities/stops, only the
  hue changed (`rgba(56,189,248,…)` in place of `rgba(255,255,255,…)` for
  the border gradient and the radial sheen). The nested request card's
  top-to-bottom gradient fill gets the same treatment on its lighter top
  stop. The grain texture layer is left achromatic — it's a shared
  `.surface-grain` utility used elsewhere and isn't specific to this
  panel's color.
- **Request timestamp — ordinal format, reusing the shared date utility.**
  "Requested 8/7/2026, 10:12:29 PM" (`Date.prototype.toLocaleString()`)
  is replaced with the same ordinal-date convention used on spot cards
  (`src/lib/formatDate.ts`, already used by `formatDateOrdinal` on
  `/venues/[id]`) — extended with a new `formatDateTimeOrdinal` export
  that additionally renders abbreviated month + 12-hour time, no seconds:
  "7th Aug, 2026, 10:12 PM". No one-off formatter was added to the panel
  itself.

**2026-08-14 third follow-up.** The cyan-sheen surface treatment from the
prior pass read as off rather than as an improvement; rolled back in favor
of a different direction, plus three unrelated fixes surfaced in the same
review:

- **Backdrop — actual blur, not just a scrim.** The overlay behind the
  panel was a flat `bg-black/60` with no blur, so the dashboard behind it
  stayed fully in focus. Added `backdrop-blur-lg` to the overlay so the
  page content is genuinely defocused, making the panel the only sharp
  element on screen — the dark scrim stays for contrast, blur is additive.
- **Panel — solid dark navy, sheen/gradient-border treatment removed.**
  The radial sheen + gradient border from the cyan-tint pass is gone. The
  panel is back to a flat single-color fill, moved off zinc-grey onto a
  solid dark blue — `rgba(6,12,32,0.97)` — so it reads as part of the
  site's navy/cyan palette by hue, not by an applied tint effect. Border
  is a plain `white/[0.08]` hairline. The panel's own `blur(40px)
  saturate(140%)` backdrop-filter (the glass-over-page-content effect,
  independent of the outer scrim blur above) and the inset-highlight /
  drop-shadow pairing are unchanged. `.surface-grain` (achromatic texture)
  stays on the panel.
- **Accept/Promote buttons — moved onto `CtaButton`.** The one-off
  `bg-[#38bdf8] rounded-lg` fill button (the last piece of this panel not
  already on the shared component, now that Cancel was migrated in the
  prior pass) is replaced by `CtaButton` in its default cyan variant — the
  same component `View Requests`/`Cancel` (spot) and `Add a new Spot` use
  elsewhere in this dashboard. `RequestCard` now always renders
  `CtaButton`, switching `variant="danger"` vs `"default"` off the
  existing `variant` prop instead of branching between two different
  button implementations.
- **Requester name — given visual weight over the timestamp.** Was
  `text-sm font-semibold` directly above an `text-[11px]` timestamp with
  only `mt-1` between them — too close in size/weight/spacing to read as
  primary vs secondary. Name is now `text-base font-bold tracking-tight`;
  the timestamp gets `mt-1.5` (more separation) and `uppercase
  tracking-wide` (a distinct small-caps treatment, not just smaller text)
  so the two are unambiguously different tiers of information rather than
  two lines of the same style.
- **Entry surface — ticket-stub notch, replacing the bordered rectangle.**
  The flat `border border-white/10` box read as a generic bordered
  rectangle. Replaced with a borderless, softly-shadowed card (elevated
  off the panel via `box-shadow`, not an outline) carrying a die-cut
  semicircle notch on its left edge — a literal punched-through hole, not
  a colored decoration: the notch's fill is set to the exact same color as
  the panel behind it (`--notch-bg`, shared via a CSS custom property so
  the two surfaces can't drift out of sync), so it reads as the panel
  showing through rather than a status-colored chip. This extends the
  panel's existing ticket idiom (the per-card dashed divider already
  stands in for a tear/perforation line) to the entry's outer shape rather
  than inventing an unrelated motif. Status identity continues to live on
  the dashed divider and section-heading accent bar, not the notch, so
  there's no duplicate color-coding. This also supersedes the prior
  "sharp corners, no `border-radius`" decision for the nested card — the
  ticket-stub notch reads naturally on a rounded (`rounded-xl`) shape, so
  entries are rounded again.

**2026-08-14 fourth follow-up.** With the backdrop now blurred (§ above),
the dashboard's spot cards behind the modal are no longer legible, so
there was no way to tell which spot the open panel's requests belong to.
Fixed by adding a subtitle line under the "Requests" heading — same font
and theme as the heading itself (`--font-bebas`, uppercase), one size down
and in `zinc-400` to read as secondary: `{date} · {start}–{end}`, e.g.
"30 AUG, 2026 · 7:00 PM – 9:00 PM". Sourced from the same `Spot` fields
`VenueProducerDashboard` already holds (`date`, `start_time`, `end_time`),
passed down as three new `RequestsPanel` props. Formatting reuses the
exact convention already shown on the spot card itself (`formatCardDate` /
`formatTime12h` from `VenueSpotCard.tsx`), rather than introducing a new
one — those two functions were extracted into the shared
`src/lib/formatDate.ts` (as `formatSpotDate` / `formatTime12h`, alongside
`formatDateOrdinal` / `formatDateTimeOrdinal`) so both `VenueSpotCard` and
`RequestsPanel` draw from one definition.

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
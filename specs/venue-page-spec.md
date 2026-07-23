# Spec: Venue Detail Page (`/venues/[id]`) Update

## 1. Context

`apps/web/app/venues/[id]/page.tsx` is the page a comedian lands on after
clicking a venue card from `/venues`. It renders a hero photo, name/address/
description, "Upcoming Shows", and "Open Spots". This spec covers
glassmorphism consistency, adding venue social links, and centering the page.

**Explicitly out of scope — not touched:**
- The comedian `/profile` page or its fan-card component.
- The legacy `VenueDetailSheet.tsx` / `VenueCard.tsx` pair (dead code, unused
  by the current `/venues` flow — not wired into any route).

## 2. Glassmorphism fix

The page's cards already use the site's canonical `.content-glass` class
(`apps/web/app/globals.css`) via `SpotlightCard`, which is `blur(24px)`.
The actual inconsistency is against its sibling page: `/venues` (the list
page) locally overrides `.content-glass` to `blur(40px) saturate(120%)` via
an inline `<style>` block, so cards look stronger there than on the detail
page a user just navigated from.

**Decision:** apply the identical local override block to the detail page,
so blur strength matches between the list and detail views.

## 3. Venue social links — data model

Fields (confirmed with user), stored on the `venues` table — not on `users`
— since they belong to the venue entity, not the producer's account:

| DB column | Type | Notes |
|---|---|---|
| `instagram_url` | text, nullable | must start with `http://` or `https://` |
| `youtube_url` | text, nullable | must start with `http://` or `https://` |
| `maps_url` | text, nullable | Google Maps link; must start with `http://` or `https://` |
| `contact_email` | text, nullable | basic email regex check |
| `contact_phone` | text, nullable | free text, no format constraint |

Migration: `apps/api/src/db/migrations/011_venue_social_links.sql`.

`Venue` interface (`packages/types/index.ts`) extended with these 5 optional
fields.

**Single source of truth:** these columns are read/written through
`GET /api/venues/:id` and `PATCH /api/venues/:id` only. When the
venue-producer-facing profile page (`VenueOwnerProfile.tsx`) is built out to
let producers edit their own socials, it reuses these same two endpoints
scoped by `owner_id` — no duplicate schema or query.

### API

- `GET /api/venues/:id` — select list extended to include the 5 fields.
- `PATCH /api/venues/:id` (new) — `requireUser` + `requireRole('venue_producer')`,
  plus an explicit ownership check (`venue.owner_id === req.userId`, 403
  otherwise, since `requireRole` alone doesn't scope to a specific venue row).
  Whitelists exactly `VENUE_EDITABLE_FIELDS = [instagram_url, youtube_url,
  maps_url, contact_email, contact_phone]`, mirroring the whitelist pattern
  in `PATCH /api/users/me`.

## 4. Social-link component

New component: `apps/web/src/components/venues/VenueSocialLinks.tsx`,
rendered after "Open Spots".

- Corner-peel card structure/timing adapted from a reference CSS pattern
  (nested boxes, decreasing size, staggered `transition-delay`: 0s / 0.15s /
  0.3s / 0.45s, all peeling out from the bottom-left corner on card hover).
- Re-skinned to the site's dark glass theme: card uses the same
  `content-glass` values (`rgba(0,0,0,0.52)` bg, `rgba(255,255,255,0.18)`
  border, `blur(24px)`); box hover reveal is a flat cyan (`#38BDF8`) wash —
  no gradients, no neon glow/drop-shadow.
- Only a box for a link the venue actually has is rendered; empty fields are
  skipped entirely. If a venue has none of the 4 fields set, the component
  renders nothing.
- Instagram / YouTube / Google Maps boxes are `<a target="_blank">` external
  links.
- The Contact box (email + phone) is **not** a link — clicking does nothing;
  hovering the card peels it open to reveal the email/phone as plain text
  (per explicit user decision — no `mailto:`/`tel:` click-through).
- Box-to-platform assignment: Contact (if present) always takes the largest
  box (most room for two lines of text), followed by Instagram, YouTube,
  Google Maps in the remaining boxes in that order — sizing is purely
  cosmetic nesting, not tied to platform identity.

## 5. Centering

`app/venues/[id]/page.tsx`'s content wrapper changed from `max-w-3xl` to
`max-w-3xl mx-auto`, matching the centered-container pattern used on
`/venues` (`max-w-7xl mx-auto`). Width kept at `3xl` (not widened to `7xl`)
since this is a single-column detail layout, not a grid.

## 6. "Upcoming Shows" spot card restyle

Scoped strictly to the `shows.map(...)` card in the "Upcoming Shows" section
of `app/venues/[id]/page.tsx`. The `/venues` landing/list cards and every
other component are unchanged. (The separate "Open Spots" card, `spots.map`
on the same page, was initially left as-is here but brought in line with
this same styling — see §7.)

- **Busking / Non-Busking label:** pill background removed — plain text on
  the glass card. `Busking` in cyan accent `#38BDF8`; `Non-Busking` in a
  complementary pink, `#F472B6`. No other neon colors (yellow/purple/green/
  red) remain on this card.
- **"X spots left":** color coding (green under/over a threshold) removed —
  plain white text. Backed by whatever mock/static data the API already
  returns; live real-time sync is explicitly deferred, not implemented here.
- **Time range:** now goes through the existing `formatTime12h`
  (`apps/web/src/lib/formatTime.ts`) instead of a `.slice(0, 5)` 24h
  substring — reused, not reinlined.
- **Date:** new `formatDateOrdinal` util (`apps/web/src/lib/formatDate.ts`)
  renders `date` as `"21st July, 2026"` instead of the raw `YYYY-MM-DD`
  string. New file since no date-formatting utility existed prior to this
  change.
- **"Book Spot" button:** an edge-expand tab variant was tried and reverted
  (didn't fit the card well). Reverted to the original static button, with
  a cyan fill and black text by default (`bg-[#38bdf8] text-black`), and on
  hover swaps to dark-blue fill with cyan text (`hover:bg-[#0a1628]
  hover:text-[#38bdf8]`) — the inverse of the resting state, previously
  `bg-[#0a1628] text-white` with cyan-on-hover. Existing disabled logic
  (in-flight booking, `available_spots <= 0`) and the "Waiting for
  confirmation" replacement state for already-booked shows are unchanged.

## 7. "Open Spots" card brought in line + stale-spots count fix

Two bugs surfaced by manually-added (non-seed) test venues:

- The "Open Spots" card (`spots.map` block, same page) still had the
  pre-redesign pill/color-coded styling even though "Upcoming Shows" had
  already been updated — inconsistent between the two sections on the same
  page. Applied the identical treatment: plain-text cyan/pink busking label,
  plain white "spots left", `formatTime12h` / `formatDateOrdinal` for
  time/date, and the Apply button recolored to match Book Spot
  (`bg-[#38bdf8] text-black`, hover swaps to `bg-[#0a1628] text-[#38bdf8]`).
- `GET /api/spots` (`apps/api/src/index.ts`) — used only by the `/venues`
  list page to total up each venue's "X left" badge — had no `date` filter,
  unlike `GET /api/venues/:id`'s spots query which already filters
  `gte('date', today)`. A venue with only past-dated (expired) spots would
  therefore show a nonzero "X left" badge on `/venues` while its own detail
  page correctly reported "No open spots at this venue." Added the same
  `gte('date', today)` filter to `/api/spots` so both endpoints agree.

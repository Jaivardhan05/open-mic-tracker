# Admin Dashboard — Spec

**Status:** Implemented
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
- Delete `apps/web/app/admin-dashboard/` entirely. **Done** — the route directory was never re-created, but three redirect call sites still pointed at it (`apps/web/app/page.tsx`'s post-login switch, and both the mount-effect redirect and the login-success switch in `apps/web/app/auth/page.tsx`), 404ing every admin login. Fixed: all three now redirect to `/home`, matching the comedian/venue_producer pattern.
- `apps/web/app/home/page.tsx` gains a branch: `user.role === 'admin'` → `<AdminHomeContent />` (currently admins fall through to `ComedianHomeContent` by accident). **Done.**
- `apps/web/app/profile/edit/page.tsx` (not `/profile/page.tsx` — the "Admin Controls" nav item actually lives one level down, on the Edit Profile sidebar): remove the "Admin Controls" sidebar nav item (pointed at the now-deleted `/admin-dashboard`). **Done** — along with the venue_producer sidebar's "My Venues" item on the same page, which pointed at `/profile/venues`, a route that was never built either.

### 6.2 `AdminHomeContent.tsx` (new — `src/components/dashboard/`)
Moved from `AdminProfile.tsx`:
- Two stat tiles: Total Venues, Pending Approvals (from `GET /api/admin/stats`)
- Pending Approvals list + Approve/Reject (existing `/api/venues/:id/approve` / `/reject`, unchanged)

New:
- **Manage Venues**: a search input, no list shown when empty. Fetches `GET /api/admin/venues` once (mirrors `/venues/page.tsx`'s "fetch once, filter client-side" approach) and live-filters by name/address using a helper extracted from that page's existing matching logic (moved to a shared location, e.g. `src/lib/venueSearch.ts`, so both pages call the same function instead of duplicating it).
- Clicking a result opens an action sheet: **Hide Venue** (and **Unhide Venue** if already hidden).
- Hide flow: confirm dialog "Are you sure you want to hide this venue?" + reason textarea, prefilled `"venue removed by admin"`, editable → `POST /api/venues/:id/hide`.

### 6.3 `AdminProfile.tsx`
Remove: Pending Approvals section, its state/handlers, and the two stat tiles being moved. Keep: profile header, remaining 2-stat row (Total Comedians, Total Bookings), All Venues list, By City block — untouched (styling of this surface addressed later, see §6.7).

### 6.4 `VenueNoticesSection.tsx` (new — `src/components/venue-dashboard/`)
- New hook `useVenueNotices` (mirrors `useVenueSpots`'s shape) fetching `GET /api/venue-producer/notices` via `authorizedFetch`.
- Rendered in `VenueProducerDashboard.tsx`, styled like `RemindersSection`'s glass cards: venue name, reason, relative timestamp. Read-only — no actions.

### 6.5 `AdminHomeContent.tsx` / `ManageVenuesSection.tsx` — styling pass (2026-09-07)
Admin `/home` originally shipped with first-draft styling that never adopted the
site's established glass/typography system. Brought in line with the venue
producer dashboard, which is the source of truth (see `specs/venue-dashboard.md`
§5.3 for the locked `RequestsPanel` treatment being replicated — that panel's
styling itself was not touched by this pass):

- **Manage Venues search input** (`ManageVenuesSection.tsx`) — the boxed,
  icon-left `content-glass` input is replaced with the shared underline
  floating-label pattern (`.float-field`/`.float-input`/`.float-label`/
  `.float-bar`, defined in `globals.css`, the same classes `/auth` and
  `RequestsPanel`'s message field use) — floating "Search venues by name or
  address..." label, cyan underline-on-focus bar, no border/icon.
- **Pending Approvals panel** — moved off the flat `content-glass` box onto
  `RequestsPanel`'s locked panel chrome: solid dark-navy fill
  (`rgba(6,12,32,0.97)`), `blur(40px) saturate(140%)`, inset top highlight +
  drop shadow, `.surface-grain` texture, `white/[0.08]` hairline border.
- **Pending-venue cards** — moved off plain `content-glass` cards onto
  `RequestsPanel`'s `notch-entry` ticket-stub card (`rgba(19,30,58,0.92)`
  fill, die-cut notch matching the panel behind it via `--notch-bg`),
  dashed amber divider above the action row (mirrors the pending-status
  divider color in `RequestsPanel`).
- **Approve/Reject** — moved off hand-rolled `bg-green-600`/
  `border-red-800 bg-red-900/50` buttons onto the shared `CtaButton`
  component: Approve in the default cyan variant, Reject on the
  `variant="danger"` (red) variant already added for `RequestsPanel`'s
  Cancel action. Verbs kept as Approve/Reject (not renamed to Accept/Cancel)
  since that's what the underlying API actions (`/api/venues/:id/approve`
  and `/reject`) actually do.
- **Fonts** — section headings ("Pending Approvals", "Manage Venues") and
  stat-tile labels moved onto `--font-bebas` uppercase, matching the
  display-heading convention used by `RequestsPanel` and the spot cards;
  card name/meta text sized/weighted the same as `RequestsPanel`'s request
  cards (`text-base font-bold tracking-tight` name, `text-[11px] uppercase
  tracking-wide` meta).
- Stat-tile shell, hero section, and `ManageVenuesSection`'s search-result
  card grid were already on `content-glass`/`BrandMark` before this pass and
  are unchanged.
- `VenueProducerDashboard.tsx`, `RequestsPanel.tsx`, and every other
  venue-dashboard component were not modified — reference only.

### 6.6 Stat-tile glass treatment (2026-09-07, superseded by §6.8)
First pass at fixing the two admin `/home` stat tiles (Total Venues, Pending
Approvals), which looked flatter than the rest of the page. Implemented as
an inline `style` override (`STAT_TILE_GLASS`, later moved to a shared
`src/lib/statGlass.ts` constant) layered on top of the `.content-glass`
class, bumping just its `backdrop-filter` to `blur(40px)`. **This mechanism
was replaced in §6.8** by a single canonical `.glass-panel` CSS class after
the same hand-copied-per-page pattern recurred on admin `/profile`
(§6.7/§6.8) — `STAT_TILE_GLASS`/`statGlass.ts` no longer exist. The
resulting visual values are unchanged; see §6.8 for the current mechanism
and the full source-of-truth derivation.

### 6.7 Admin `/profile` — design-system conformance (2026-09-07)
Admin `/profile` (`AdminProfile.tsx`) predated the site's glass/typography
system entirely — flat `bg-zinc-900`/`bg-black/30` panels with plain
`border-zinc-800` borders, no `backdrop-filter` anywhere, a red role badge,
and small-caps-less `text-lg font-semibold` headings. Pure styling pass, no
functional/data/layout change (same sections, same fields, same sidebar
links) — brought onto the same tokens already established elsewhere on the
site and locked in §6.5/§6.6 above:

- **Header** (avatar, name, role badge, city) — matches the shared
  `ProfileHeader.tsx` component's exact treatment (used by the comedian and
  venue_producer profile pages): avatar `bg-[#38bdf8]/20` fill with a cyan
  ring + soft glow (`ring-2 ring-[#38bdf8]/55`, `shadow-[0_0_14px_2px_rgba(56,189,248,0.25)]`),
  role badge recolored from red to the same cyan pill
  (`bg-[#38bdf8]/20 text-[#38bdf8]`) every other role's badge uses.
  `AdminProfile` doesn't render `<ProfileHeader>` directly since it shows a
  hardcoded city line where the shared component shows a "Joined" date —
  data unchanged, but the city line now carries the same
  `mt-1 text-xs text-zinc-600` treatment `ProfileHeader` uses for its
  equivalent secondary line.
- **Stat tiles** (Total Comedians, Total Bookings) — glass treatment as it
  stood at the time (superseded by §6.8 — see that section for the current,
  correct implementation). Label styling matches: `--font-bebas` uppercase
  `zinc-500` caption under a `text-2xl font-bold` number.
- **All Venues panel** — outer container's glass treatment as it stood at
  the time (superseded by §6.8 — this pass under-shot `/support`'s actual
  blur intensity, which prompted §6.8). Per-venue rows originally kept as a
  bordered/backgrounded pill per row; **replaced by §6.8** with flush
  divider-separated rows. "Approved"/"Pending" badges resized from
  `px-2 py-1 text-xs` to `px-2 py-0.5 text-[11px]`, matching the badge
  sizing already used by `ManageVenuesSection`'s Pending/Hidden tags —
  unaffected by §6.8 and still current; colors unchanged (green for
  Approved — no other page had an existing "Approved" convention to match,
  so the current amber-for-Pending/green-for-Approved pairing was kept and
  just resized).
- **By City panel** — moved onto `content-glass` (unaffected by §6.8 — not
  one of the panels named in that pass).
- **Section headings** ("All Venues", "By City") — moved onto
  `--font-bebas` uppercase (`text-2xl tracking-[0.04em]`), matching the
  heading treatment already used on admin `/home` (Manage Venues, Pending
  Approvals, §6.5).
- **Sidebar** (`apps/web/app/profile/page.tsx`) — inspected, not modified:
  already on `sidebar-glass` (`blur(40px) saturate(120%)`, the same class
  `Sidebar.tsx` on `/home` and `/venues` uses) with the same cyan
  active-state treatment used everywhere else nav items appear. No
  off-system styling found here.
- No section was added, removed, or reordered; no data field shown/hidden
  changed; `/support`, `ProfileHeader.tsx`, and every other role's profile
  page were not touched.

### 6.8 `.glass-panel` — canonical glassmorphism class (2026-09-07)

**`/support` (`app/support/page.tsx`) is the single, canonical source of
truth for this site's glassmorphism, full stop.** Every glass panel added
anywhere in the app from this point on must use the shared `.glass-panel`
class defined below (`globals.css`) — not a fresh `backdrop-filter`/
`background`/`border` trio hand-copied or eyeballed per page. This section
exists because that hand-copying already happened twice: `.content-glass`'s
own default blur (`blur(24px)`) undershoots what `/support` actually renders
(`/support` scopes it up to `blur(40px)` via a page-local `<style>`
override), and the first fix for admin `/home`'s stat tiles (§6.6) and the
first pass at admin `/profile` (§6.7) each re-derived that same `blur(40px)`
value as an ad hoc inline-style override instead of a shared definition —
exactly the inconsistent-reimplementation pattern this section closes off.

**Derivation** — `/support`'s panels (`SpotlightCard`, which renders
`.content-glass`) compute to:

| Property | Value | Source |
|---|---|---|
| `background` | `rgba(0, 0, 0, 0.52)` | `.content-glass` base (`globals.css`) — unchanged by `/support`'s override |
| `border` | `1px solid rgba(255, 255, 255, 0.18)` | `.content-glass` base (`globals.css`) — unchanged by `/support`'s override |
| `backdrop-filter` | `blur(40px) saturate(120%)` | `/support`'s page-scoped `.content-glass` override (`app/support/page.tsx`) |
| `box-shadow` | none | not set anywhere in this chain |

**Implementation** — `.glass-panel` (`globals.css`, next to `.content-glass`)
inlines that exact computed result as one self-contained class, so it no
longer depends on `/support`'s page-local override or on hand-copying:

```css
.glass-panel {
	background: rgba(0, 0, 0, 0.52);
	border: 1px solid rgba(255, 255, 255, 0.18);
	backdrop-filter: blur(40px) saturate(120%);
	-webkit-backdrop-filter: blur(40px) saturate(120%);
}
```

**Applied to** (this pass): admin `/home`'s two stat tiles
(`AdminHomeContent.tsx`) and admin `/profile`'s two stat tiles + All Venues
panel (`AdminProfile.tsx`) — all five moved from `content-glass` (+, where
present, the now-deleted `STAT_TILE_GLASS` inline override /
`src/lib/statGlass.ts`) onto plain `glass-panel`. Admin `/profile`'s By City
panel, the Pending Approvals panel (which intentionally uses a different,
separately-locked navy treatment, §5.3 of `specs/venue-dashboard.md`), and
`ManageVenuesSection`'s search-result cards were **not** touched — nothing
required them to change, and retrofitting every existing `.content-glass`
usage site-wide was explicitly out of scope. `.content-glass` (`blur(24px)`)
itself is untouched and remains valid for panels that were already correctly
using the sitewide default tier — `.glass-panel` is the *stronger*,
`/support`-derived tier, not a replacement for `.content-glass` everywhere.

**Rule going forward:** any new glass panel, anywhere in the app, uses
`.glass-panel` (or, if a panel is deliberately not on the `/support` tier —
e.g. `RequestsPanel`'s locked navy chrome — its own already-locked spec
section) rather than a new hand-written `backdrop-filter`/`background`/
`border` combination. `/support` itself was not modified — it remains the
reference, not a target.

### 6.9 "All Venues" row styling (2026-09-07)
Each venue in `AdminProfile.tsx`'s All Venues list was its own separate
rounded, bordered, background-tinted pill (`rounded-xl border border-white/10
bg-white/[0.04]`) stacked with `mb-2` gaps. Replaced with flush rows inside
one continuous `.glass-panel` container, separated by a hairline divider
(`divide-y divide-white/10` on the panel, plain `px-4 py-3` rows with no
per-row border/background/radius). The "Approved"/"Pending" status badge is
unchanged.

---

## 7. Don't touch
Comedian `/profile`, `/profile/edit`, the fan-card animation, venue producer's own show-management flows (`AddSpotForm`, `RequestsPanel`, `CancelSpotDialog`, `VenueCalendarSection`).

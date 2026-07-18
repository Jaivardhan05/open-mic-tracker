# Spec: Comedian Profile Page (`/profile`) Revamp

## 1. Context

`/profile` is currently a rough first draft — placeholder stats, generic
layout, no real thought given to information hierarchy or role-awareness.
This spec defines what the page needs to become. It does **not** cover
`/profile/edit` (separate page, separate concerns) and does **not** cover
dashboards for venue_producer or admin roles — those come later.

This document is an input for planning only. Read it fully, then produce
an implementation plan before writing any code.

## 2. Scope

**In scope:**
- Full redesign of the `/profile` page content, layout, and information
  architecture for the `comedian` role.
- Role-awareness: the page must render different content depending on
  whether the logged-in user is `comedian`, `venue_producer`, or `admin`.
  Build the comedian version now; stub the other two role branches
  cleanly so they're easy to fill in later without restructuring.

**Explicitly out of scope — do not touch:**
- The site-wide background image, its fixed behavior, or how it's applied.
- The navbar — its content, styling, or interaction behavior.
- The sidebar — its content, styling, or interaction behavior.
- `/profile/edit` page.
- Any dashboard views for venue_producer or admin.

If achieving a goal in this spec seems to require touching any of the
above, stop and flag it instead of proceeding.

## 3. Required Data (Comedian Role)

The profile page must display, at minimum:
- Username
- Email address
- Phone number
- Profile picture
- Role badge (already exists — keep)
- City (already exists — keep)

Beyond the minimum, use judgment to decide what else belongs on a
comedian's own profile view. Consider things like: bio/tagline, social
links, experience level or years performing, genres/style tags, stats
that are actually meaningful (not placeholder zeros — think about what a
comedian would actually want to see about their own activity), and any
lightweight visual identity elements. Don't add anything that only makes
sense once bookings/venues data exists in bulk — this page should look
complete and intentional even with an empty or near-empty account.

## 4. Role Branching

- If the logged-in user's role is `comedian`, render the comedian profile
  view described in this spec.
- If `venue_producer` or `admin`, render a distinct placeholder/stub view
  for now, structured so it's obvious where role-specific content will
  slot in later. Do not attempt to design the venue_producer or admin
  profile content now — just make the branching clean.

## 5. Design Constraints

- Follow the site's existing dark theme, font pairing. same rules as
  the rest of the site.
- **Do not lean on glassmorphism.** It's already used heavily elsewhere
  on the site. Find a different way to give this page visual distinction
  — texture, spacing, typography, subtle borders, or other techniques
  that don't repeat the same effect a fourth time.
- No emojis — SVG icons only, consistent with the rest of the site.
- No gradients, no neon effects, no font changes beyond what's already
  established.
- Mobile-first. This page must work cleanly on a phone, not just look
  fine on desktop and degrade on mobile.

## 6. UX Goals

The rebuilt page should feel:
- **Comfortable** — not cramped, not sparse; correct breathing room.
- **Easy to scan** — a comedian should immediately find their info
  without hunting through sections.
- **Accessible** — sufficient contrast, sensible touch target sizes,
  readable at a glance on mobile.
- **Unique** — should not feel like a copy-pasted generic dashboard
  template.
- **Creative but restrained** — creative in layout/interaction choices,
  not in adding decoration for its own sake.

You are free to research current best practices for profile page design
(information hierarchy, mobile profile patterns, etc.) via web search if
it helps produce a better plan. Ground decisions in what actually serves
a comedian checking their own profile, not trend-chasing.

## 7. Process

1. Read this spec in full.
2. Investigate the current `/profile` page implementation, and review how
   `/home` and `/venues` structure their content, so the new profile page
   feels native to the existing site rather than bolted on.
3. Produce a written implementation plan covering: proposed information
   architecture, component breakdown, role-branching approach, and any
   open questions — before writing code.
4. Do not implement until the plan has been reviewed and approved.

## 8. Explicit Non-Goals for This Round

- No changes to background image, navbar, or sidebar (content or
  behavior).
- No `/profile/edit` changes.
- No venue_producer or admin profile content design.
- No dashboard work.
- Further UI/UX changes will come in follow-up rounds after this first
  version ships — do not try to anticipate or over-build for them now.

## 9. Deliverable for This Prompt

An implementation plan only. Once approved, execution happens in a
separate, scoped prompt.

## 10. Fan-Card Follow-Up Fixes (2026-07-16)

Scoped follow-up to the fan-card component only
(`src/components/profile/flashcards/*`), not a re-scope of the page:

- **Stacking on hover/focus**: any individual card (`.card:hover` /
  `.card:focus-within`) takes top `z-index`, overriding the static
  per-slot stacking order, so a hovered/focused card is never partially
  hidden by a fanned-out neighbor. The Gmail card (which has no `href`)
  gets `tabIndex={0}` so it can receive keyboard focus like the linked
  cards.
- **Logo-forward social cards**: social cards drop the small top-left
  icon placement in favor of a large, centered brand mark occupying most
  of the card, with handle/detail text pinned to the bottom. Icon sizing
  is per-brand (Instagram/X/YouTube/Gmail marks aren't uniform shapes).
- **Reduced fan spread**: hover-state translate distances scaled down
  ~20% across all four slots (rotation unchanged) so the outermost cards
  (particularly Instagram, the leftmost) stay within the content area and
  don't get clipped behind the fixed sidebar on `/profile`.
- **Center card visual treatment**: explicitly **not** glassmorphic
  (glassmorphism is already used heavily elsewhere on the site, per
  Section 5). Instead: opaque layered-dark background, a subtle grain
  texture overlay, and a thin cyan (`#38BDF8`) gradient rim in place of
  the flat single-color border — a "layered darkness + glow" treatment
  rather than a frosted-glass one. No `backdrop-filter`/translucency, no
  neon saturation, same Bebas Neue / Cormorant Garamond italic pairing.

## 11. `/profile/edit` Brutalist Field Recolor (2026-07-19)

Scoped follow-up to `BrutalistField.module.css` only (Section 8's original
"no `/profile/edit` changes" applied to this spec's initial scope, not to
this later, separately-approved pass). Second iteration after an initial
cyan-label recolor — this pass targets the input box itself, which still
read as a light gray-and-white double frame clashing with the dark theme.

- **Container** (`.container`): background darkened from `#f0f0f0` to
  `#0b1220` so the padding collar around each field reads as one tonal
  piece with the field itself, rather than gray-around-navy. Border stays
  black, 2px. Offset shadow reduced from `10px 10px 0 #000` to
  `2px 2px 0 #000` — kept, but no longer dominant. Hover-state glow stays
  cyan (`#38bdf8`, matching the label-tag accent from the prior pass) but
  its offset is reduced from `20px` to `4px` to match the smaller resting
  shadow.
- **Field, editable state** (`.field` default): fill `#16233a`
  (desaturated navy), rim `1px solid #2f4867` (a lighter step of the same
  navy family, not a contrasting color) — thin rim, not the previous
  `2px`/`3px` heavy black block. Hover/focus fill lightens one step to
  `#1c2c47`; hover/focus shadow reduced to `2px 2px 0 #2f4867` (navy, not
  black).
- **Field, locked/disabled state** (`.field:disabled`, used for Full Name
  and Email on the comedian branch): fill `#0f1a2b` (darker navy step,
  recedes relative to editable fields), rim `1px solid #23344c` (dimmer
  navy step) — same family as editable, distinguishable by being darker/
  dimmer rather than a different hue.
- **Text**: entered value `#f5f7fa` (near-white) in both states; disabled
  text `#93a3b8` (dimmer, still legible); placeholder text `#7b8ba3`
  (dim blue-gray, replacing the previous `#666` gray).
- Cyan label tags (`.container::before`, `#38bdf8`) from the prior pass
  are unchanged.
- No gradients or glow/neon effects introduced — all flat colors, per the
  site's existing design-system constraint (Section 5).
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
# Spot Card Mobile Rendering Fix — In-Progress Notes

Status as of 2026-08-07. This file exists so a fresh session can pick up
exactly where this one left off, without re-deriving the investigation.
Delete this file once the mobile fix ships and is verified.

## Context: what preceded this task

The Reminders & Confirmations spot cards on the comedian `/home` dashboard
were redesigned from a glowing/text-shadow glass card into a "ticket stub"
layout (user-picked direction, see `specs/venue-dashboard.md` §6 for the
finalized spec of that redesign). That redesign is **done and committed to
the working tree** (not yet git-committed as of this writing):

- `apps/web/src/components/dashboard/SpotRequestCard.tsx` — full rewrite.
  Two-part layout: flex-1 main stub (venue name headline, date/time/type
  meta row, `CtaButton` actions) + fixed-width (`w-12`/`w-14`) right-hand
  status stub, separated by a dashed border, with two small decorative
  "punch-hole" circles (`absolute -top-2.5` / `-bottom-2.5`) and a
  vertical status label (`writing-mode: vertical-rl` + `transform:
  rotate(180deg)`, so it reads bottom-to-top). No text-shadow anywhere.
  Reuses `CtaButton` (`apps/web/src/components/CtaButton.tsx`) as-is for
  "View Venue" / "Cancel Spot".
- `apps/web/src/components/dashboard/RemindersSection.tsx` — now includes
  `pending` in the visible-statuses filter (previously only
  accepted/waitlisted/cancelled_by_venue were shown).
- `apps/api/src/index.ts` (`GET /api/spot-requests/mine`) — added a filter
  so `cancelled_by_venue` rows drop off 24h after cancellation, using
  `decided_at` (no schema migration needed — `decided_at` is overwritten on
  every status transition, so for a row currently at `cancelled_by_venue`
  it already holds the cancellation timestamp).
- `specs/venue-dashboard.md` §6 — updated to document all of the above.

None of this original redesign work is in question — it's the baseline the
mobile bug report came in against.

## The task now: mobile rendering fix

User-reported: the redesigned card "doesn't render correctly on mobile
viewports. Works fine on desktop." Requirements:
1. Investigate first — reproduce at several mobile breakpoints, identify
   exactly what's broken, report before touching code.
2. Fix so all content (venue name, date, time, type, status, both actions)
   is visible and usable, with tap targets ≥44px.
3. Don't change the desktop layout direction — responsive fix only.

## Investigation environment (how to resume testing)

No project-level run/browser-automation skill exists in this repo yet
(checked `.claude/skills/` at every level up from cwd — nothing). No
`chromium-cli` tool available either. Environment does have a Playwright
*browser* cache but not the npm package pre-installed, so the working setup
was:

1. **Start both dev servers** (both must be running — the API one is easy
   to forget and produces an unrelated-looking failure, see the "detour"
   below):
   ```bash
   cd apps/web && npm run dev   # port 3000
   cd apps/api && npm run dev   # port 8080 — Next.js proxies /api/* to this
   ```
   Poll instead of sleeping: `until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done`

2. **Debug route** (temporary, uncommitted, still present in the tree):
   `apps/web/app/debug-spot-card-preview/page.tsx` — a client component
   that renders `SpotRequestCard` directly with mock props for all four
   statuses (pending/accepted/waitlisted/cancelled_by_venue), one with a
   `venueMessage` and one without, inside the same
   `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` wrapper `RemindersSection`
   uses. This sidesteps needing a real logged-in session (the real `/home`
   route requires Supabase auth + localStorage `openmic_user`) to visually
   test the component in isolation.
   - **Important Next.js gotcha hit here**: a leading underscore
     (`_debug-spot-card`) makes Next.js treat the folder as a private,
     non-routable segment — 404s silently. Route must not start with `_`.
   - Delete this route before shipping; it's routable in prod builds too
     since nothing gates it behind dev-only middleware.

3. **Playwright driver**: `npm install playwright@1.57.0` inside the
   scratchpad directory (with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, since a
   browser binary was already cached but under a different Playwright
   version's expected path). The installed package then can't find its
   expected browser revision (`chromium_headless_shell-1200` vs the cached
   `chromium-1234`), so **launch with an explicit `executablePath`**
   pointing at the cached binary:
   ```js
   chromium.launch({
     executablePath:
       "/Users/jaivardhan/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
   })
   ```
   Scratch scripts from this session (screenshotting / measuring) are in
   this session's scratchpad dir, not the repo — they did not persist
   anywhere durable. Recreate similar scripts next time; the pattern that
   worked is above.

## False positive already ruled out — don't re-chase this

The first thing that looked like "the bug" was **not real** — worth
recording so it isn't re-discovered from scratch:

- Screenshotting with Playwright's `fullPage: true` (or a `clip` region
  taller than the actual `viewport.height`) produced images where the
  ticket-stub's vertical status text and the decorative punch-hole circles
  appeared to overlap/clip mid-card (e.g. "CANCELLED BY VENUE" rendering as
  fragments around a circle with a stray "N" glyph inside it).
- This was a **screenshot-capture artifact**, not a rendering bug: DOM
  measurement (`getBoundingClientRect`) of the circles and the status text
  span showed correct, non-overlapping positions in all cases (e.g. at
  320px width: top circle spans -9px to 11px, text spans 45px to 177px,
  bottom circle spans 211px to 231px, card height 222px — comfortably
  non-overlapping).
- Confirmed as an artifact by re-shooting with a **viewport tall enough to
  contain the whole page** (e.g. `height: 1600`) and a plain (non-`clip`,
  non-`fullPage`) screenshot — the ticket stub rendered perfectly clean at
  320/360/375/390/414/428px widths: full venue name, meta row, note,
  buttons, and the complete vertical status label, no clipping, no overlap.
- **Takeaway for next session**: when screenshotting this page again, set
  `viewport.height` generously larger than the tallest card stack you're
  capturing (1400–1600px was sufficient for the 4-card debug grid), and
  avoid relying on `fullPage: true` for this Chromium build — it appears to
  tile/stitch in a way that produces seam artifacts around
  absolutely-positioned elements near a container edge.

## Confirmed real bug — this is where to resume

**CTA button tap targets are below the 44px minimum, and stacked buttons on
narrow widths sit close together.**

Measured on the debug page at 375px width, first card (`pending` status,
has both "View Venue" and "Cancel Spot"):

- Each `.cta` button: `height: 29px`, `padding: 0px`, `min-height: auto`.
  This comes from `apps/web/app/globals.css` `.cta` (line ~203) — it's
  deliberately unstyled as a box (`padding: 0; background: none; border:
  none`) per the "text + arrow + underline, no box" design brief, so its
  hit area is just the text/icon's natural line-height (~29px at the
  16px font-size `.cta span` uses).
- At narrow widths, "View Venue" and "Cancel Spot" (`flex flex-wrap
  items-center gap-x-6 gap-y-2` in `SpotRequestCard.tsx`) wrap onto two
  stacked lines instead of sitting side by side. Measured at 320px, card 1:
  button 1 spans y=179.7–208.7 (29px tall), button 2 spans y=216.7–245.7 —
  only an **8px gap** between them, so the two 29px hit areas are packed
  into a 66px vertical run with no room for a comfortable ≥44px tap
  target on either.
- This is consistent with the "works on desktop" report: at desktop widths
  the buttons often sit side-by-side (more horizontal room before
  `flex-wrap` kicks in) and mouse-pointer precision doesn't expose small
  hit areas the way touch does — same DOM/CSS, but the failure mode is
  touch-target size, not a visual layout break, so it wouldn't be "seen"
  by eyeballing a desktop browser at all.

### What hasn't been done yet
- No fix has been written. `CtaButton.tsx` and the `.cta` CSS were **not**
  touched this session (task explicitly said not to redesign the button
  component itself — reuse it as-is — so the fix should almost certainly
  be a wrapper/spacing change in `SpotRequestCard.tsx`, e.g. giving each
  `CtaButton` a min-height/padding via a wrapping element with an
  invisible larger hit-slop, and/or increasing `gap-y` between stacked
  buttons — not editing `.cta` globally, since that's shared by
  `venues/[id]`, `support`, `profile/edit`, and the venue dashboard, and
  the task scope is this card only).
- Have **not yet checked** whether other elements need the same tap-target
  treatment (e.g. is there any other interactive control on the card?
  There isn't currently — just the two `CtaButton`s — so this is likely
  the only fix needed for the ≥44px requirement).
- Have **not yet re-verified layout at breakpoints below 320px** (e.g. very
  old small-Android widths) or checked landscape/short-viewport cases,
  though these are lower priority than the confirmed bug above.
- Have **not** removed the temporary debug route
  (`apps/web/app/debug-spot-card-preview/`) — keep it for continued testing
  in the next session, then delete before considering the mobile-fix task
  done.

### Suggested next steps
1. Restart both dev servers (see above) and re-open
   `http://localhost:3000/debug-spot-card-preview` at 320/375/414px to
   confirm the tap-target measurements still reproduce (nothing else
   changed in the meantime, but re-verify before editing).
2. Fix tap targets in `SpotRequestCard.tsx` only — expand each button's hit
   area to ≥44px height (e.g. wrap `CtaButton` in a `<span>`/`<div>` with
   `min-h-[44px] inline-flex items-center`, or add vertical padding on a
   wrapper — don't add padding/box styling to `.cta` itself, that breaks
   the "no box" design elsewhere). Increase `gap-y` between the two
   buttons when stacked so the two ≥44px targets don't touch.
3. Re-screenshot at 320/375/390/414px (tall viewport, per the note above)
   and re-measure button `getBoundingClientRect()` to confirm ≥44px height
   and adequate spacing.
4. Confirm nothing broke at desktop widths (this is a responsive-only fix
   — the desktop side-by-side layout and existing spacing should be
   unaffected, but verify).
5. Delete `apps/web/app/debug-spot-card-preview/` once satisfied.
6. Update this file's "Status" line or delete it entirely once the fix is
   verified and merged — don't let it go stale in `specs/`.

## Also fixed this session (unrelated detour, already resolved)

The `/venues` page was reported broken ("Failed to load venues."). Root
cause: the API dev server (port 8080) simply wasn't running, so Next.js's
`/api/*` rewrite proxy (`apps/web/next.config.mjs`) had nothing to forward
to, and the fetch in `apps/web/app/venues/page.tsx` threw into its generic
catch block. Fixed by starting `cd apps/api && npm run dev` — not a code
bug, no code change was made for this. If a fresh session sees the same
error, check `lsof -i :8080` before assuming it's a regression.

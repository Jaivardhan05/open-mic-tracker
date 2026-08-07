# Spot Card Mobile Rendering Fix — In-Progress Notes

Status as of 2026-08-08. This file exists so a fresh session can pick up
exactly where this one left off, without re-deriving the investigation.
Delete this file once the mobile fix ships and is verified.

## 2026-08-08 update — both known bugs now have code fixes, unverified

Two fixes were made this session, code-level only — **not yet visually
verified on-device**, per the user's instruction that they'll check
rendering themselves by running the dev server.

1. **Tap-target fix** (the bug already confirmed in the section below):
   `SpotRequestCard.tsx`'s two `CtaButton`s are now each wrapped in
   `<span className="inline-flex min-h-[44px] items-center">`, and the
   button row's `gap-y-2` became `gap-y-3`. `.cta` itself and
   `CtaButton.tsx` were left untouched, per scope.

2. **New bug reported this session, root-caused and fixed**: the "Failed
   to fetch" `TypeError` in `authorizedFetch` (`apiClient.ts:13`), seen on
   a real phone hitting the dev server over LAN (screenshot showed the
   page loaded fine at `168.29.13:3000` but every API call failed).
   Root cause, confirmed by reading code (not guessed):
   - `apiClient.ts` and `app/profile/edit/page.tsx` both defaulted
     `API_URL` to the **absolute** string `"http://localhost:8080"` when
     `NEXT_PUBLIC_API_URL` isn't set — and it isn't set anywhere
     (`apps/web/.env.local` only has the two `NEXT_PUBLIC_SUPABASE_*`
     keys, confirmed by reading the file).
   - Every `authorizedFetch(path)` call site already passes paths like
     `/api/me/bookings/pending` (confirmed by grepping every call site),
     so the resulting request was `fetch("http://localhost:8080/api/...")`
     — an absolute URL, issued directly from the browser.
   - On a phone, "localhost" in that absolute URL resolves to the phone
     itself (nothing listens on port 8080 there), hence "Failed to fetch".
     Desktop "worked" only because desktop's `localhost` happens to be the
     same machine as the dev server.
   - `apps/web/next.config.js` already has an `/api/:path*` rewrite to
     `http://localhost:8080` that runs **server-side** inside the Next.js
     process (so its `localhost` is always correct, regardless of which
     device the browser is on) — and `app/venues/page.tsx` already calls
     `fetch('/api/venues')` with a **relative** path for exactly this
     reason, which is why `/venues` worked fine on the same phone once the
     API dev server was started (see the "detour" note below). This is
     confirming precedent inside the same codebase, not a guess.
   - Fix: changed the fallback in both `apiClient.ts` and
     `app/profile/edit/page.tsx` from `"http://localhost:8080"` to `""`,
     so unset-env-var requests go out as relative paths and ride the
     existing rewrite proxy, same as `/venues` already does. Behavior when
     `NEXT_PUBLIC_API_URL` *is* explicitly set (e.g. a real prod API
     domain) is unchanged.
   - Grepped for remaining `localhost:8080` references after the fix:
     only `next.config.js` (correct, server-side) and stale
     `.next/` build output remain (regenerates on next dev run) — no other
     source file needs the same fix.

## 2026-08-08 update #3 — root cause of "laptop stretched" was the 600–767px band, not padding

User reverted `py-4` entirely (back to the button-tap-target fix only, zero
status-column padding) and still saw the laptop view "stretched." Re-swept
clearance with Playwright on that exact reverted state and found the real
bug: with **zero** padding, clearance between the top punch-hole circle and
the status text goes **negative (~‑4px, real overlap)** across roughly
**600–767px** — a band that includes plausible laptop-with-sidebar content
widths, not just phones. The earlier investigation (session #1/#2) only
swept up to 414px and missed this because the layout is non-monotonic:
clearance improves 390→550px, then collapses again right before the
`md:` (768px) 2-column breakpoint gives cards room back.

Fix: reapplied the padding but scoped to `py-4 md:py-0` (was previously
unscoped `py-4`/`py-5`), so it's structurally impossible for it to add any
height at 768px+ — verified the 768/900/1024/1280px card heights are
byte-for-byte identical with and without the padding class. `<768px`
clearance is now ≥6px everywhere in a re-swept 320–767px range (previously
dipped to ‑4px around 600–750px and to +5px around 390–414px).

### Still to do next session
- Visually re-verify the tap-target fix at 320/375/390/414px (desktop
  unaffected check too) — not done this session per user instruction.
- Verify the "Failed to fetch" fix on the actual phone used for the
  screenshot (reload `/home`, confirm the Reminders section loads without
  the Turbopack error overlay).
- Delete the debug route (`apps/web/app/debug-spot-card-preview/`) once
  everything is confirmed — still present, see below.
- Delete/trim this progress file once both fixes are confirmed shipped.

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

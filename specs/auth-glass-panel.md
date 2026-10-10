# /auth main card — glass treatment

Scope: the large card (`<section class="glass-panel cardShell">` in
`apps/web/app/auth/page.tsx`) holding the logo, tagline, Log In / Sign Up
toggle, role panels and forms. Content and layout inside it are unchanged.

## Goal

Match `/support`'s glass exactly (the site-wide standard, see
`specs/admin-dashboard-spec.md` §6.8): background `rgba(0,0,0,.52)`, border
`1px solid rgba(255,255,255,.18)`, `backdrop-filter: blur(40px) saturate(120%)`,
no box-shadow, plus `/support`'s static grain. Radius stays 20px (the card's
own; `/support` panels are 16px — deliberate).

## Root cause of the earlier "transparent box" look

The CSS was right in the source and wrong in the browser. `.cardShell` (and
the shared glass classes) declared `backdrop-filter` followed by
`-webkit-backdrop-filter`. The build's CSS step (Lightning CSS, Next's default
targets) keeps only the prefixed declaration in that order, so Chrome received
no `backdrop-filter` at all: computed value `none`, curtain folds visible
straight through the card. Previous fixes edited values/structure inside CSS
that goes through the same step, so the blur was dropped every time.
`/support` looked right because it overrides `.content-glass` in an inline
`<style>` block inside the page, which bypasses the build step.

Reproduction: Lightning CSS with chrome/edge/firefox 111 + safari 16.4 —
`backdrop-filter` then `-webkit-backdrop-filter` → only `-webkit-` kept;
unprefixed only, or `-webkit-` first → both emitted.

## What changed

- `globals.css` `.glass-panel`: declares only `backdrop-filter` (build adds
  the prefix). Comment explains why. Also fixes the five admin panels that
  already used the class (they now blur in Chrome).
- `page.tsx`: the card gets the `glass-panel` class (single source of truth —
  no parallel copy of the values).
- `auth.module.css` `.cardShell`: background/border/backdrop-filter removed;
  radius, padding, size kept; `position: relative` added (anchor for the grain
  layer, no layout effect).
- `.cardShell::before`: static grain — same SVG fractal-noise tile and settings
  as `SpotlightCard`'s `NOISE_URI` (opacity 0.055, `mix-blend-mode: soft-light`,
  repeat). `z-index: -1` inside the card's own stacking context (created by
  the backdrop-filter), so it paints on the glass but *behind* all content:
  no effect on form readability. `pointer-events: none`. No cursor spotlight,
  no tilt, no JS. The data-URI is duplicated from the TSX constant because CSS
  can't import it — if the grain is ever retuned, change both.

## Known issue (not fixed here)

`.content-glass`, `.navbar-glass`, `.sidebar-glass`, `.mobile-menu-glass` in
`globals.css` still declare `backdrop-filter` before `-webkit-backdrop-filter`
and compile to the prefixed form only, so they have no blur in Chrome/Firefox.
Panels using `.content-glass` on `/support` are fine only because that page's
inline `<style>` re-declares the blur. Fix (separate task): in each rule,
declare only the unprefixed `backdrop-filter`. This will visibly change every
page that uses them.

## Verification (Chrome headless, computed styles)

`/auth` card vs `/support` panel: background, border, backdrop-filter and
box-shadow identical; `/support` unchanged by this work; admin `/home` and
`/profile` `.glass-panel` elements differ only in `backdrop-filter`
(`none` → `blur(40px) saturate(1.2)`). Checked Log In and Sign Up at 375,
768 and 1280px; no horizontal overflow; card size unchanged. Not verified:
Safari/Firefox rendering, real-device GPU/scroll performance of the blur.

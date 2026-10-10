# /auth role panels — "Marquee Plates"

Scope: the two role-selection panels ("Comedian", "Venue Producer") shown on
`/auth` in sign-up mode. Files: `apps/web/app/auth/page.tsx`,
`apps/web/app/auth/auth.module.css`. `.roleGrid` / `.roleCard*` are CSS-module
classes local to `/auth`; nothing else uses them.

Content (icons, titles, descriptions, fonts, palette) is unchanged. Only
presentation and accessibility attributes changed. Selected role is still the
`role` state (default `"comedian"`), set only through `setRole`.

## Design

Each panel is a small theatre marquee sign.

- **Bulb rim** — a decorative `aria-hidden` SVG (`.roleMarquee`) inset 5px from
  the card edge. Two identical rounded `<rect>`s (`rx` 13, concentric with the
  18px card radius) drawn with `stroke-linecap: round` and a zero-length dash
  (`stroke-dasharray="0 1.7857"` on `pathLength="100"`), so the dashes render as
  56 evenly spaced round bulbs that follow the corners and close with no seam
  at any card size (~12px pitch desktop, ~14px stacked mobile).
  - `.roleBulbsOff`: white 22% (lights off).
  - `.roleBulbsOn`: `#38bdf8`, opacity 0 → 1 when selected, with a soft cyan
    `drop-shadow` on the wrapper.
- **Check badge** — decorative 18px radio-style circle top-right (`.roleCheck`):
  empty ring when unselected, filled cyan with a check when selected. Selection
  is therefore conveyed by shape and brightness, not colour alone.
- **Selected card** — `#38bdf8` border, cyan 14% tint, soft outer + inner cyan
  glow (outer spread kept to 18px so it doesn't bleed into the 12px gap when
  stacked).

## States and motion

| State | Behaviour |
|---|---|
| Selected | Lit bulbs, filled check, cyan border/tint/glow. Fully visible with no animation. |
| Becoming selected | ~300ms ease-out on bulb opacity, glow, border, tint, badge. |
| Hover (`@media (hover: hover)` only) | 1px lift; unselected card's bulbs warm to 40% and border brightens. Not applied on touch. |
| Pressed | `scale(0.985)`, 100ms. |
| `:focus-visible` | 2px white outline, 3px offset (sits outside the lit rim; follows the rounded corners). Not shown for mouse clicks. |
| `prefers-reduced-motion: reduce` | All transitions and hover/press transforms off; selected state still obvious. |
| `forced-colors: active` | Border, bulbs and badge fall back to system colours (`Highlight`, `GrayText`, `ButtonText`). |

No looping animation, no cursor tracking, no JS-driven styling, no
`backdrop-filter` (avoids glass-on-glass inside the card).

## Accessibility semantics

- Wrapper: `role="radiogroup"` with `aria-label="Account type"` (not visible).
- Each panel: `role="radio"`, `aria-checked`, and roving `tabIndex` (0 on the
  selected panel, -1 on the other) so Tab enters the group once.
- Keyboard: Arrow Right/Down moves to and selects the next panel, Arrow
  Left/Up the previous (wrapping). Handler (`handleRoleKeyDown`) calls only the
  existing `setRole` and moves DOM focus to the newly selected panel. Enter /
  Space still select via the native button `onClick`.
- Decorative spans are `aria-hidden`.

## Unchanged on purpose

Form, auth and submit logic; how `role` is stored or used (it still decides
which signup form renders); the Log In / Sign Up toggle; every other page and
component.

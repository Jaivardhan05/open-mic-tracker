# Toast Notification — Spec

**Status:** Implemented
**Scope:** a single shared "small confirmation" primitive, used app-wide.

---

## 1. Background

No toast/notification primitive existed anywhere in the codebase before
this (confirmed by inspection — grepped for `toast|snackbar|banner` across
`apps/web`, no matches). Success/error feedback was previously handled with
static, non-dismissing inline banners re-implemented per page (e.g.
`/profile/edit`'s `saveSuccess` state rendering a plain green `<div>`).
This spec introduces one reusable toast so every future "saved
successfully" moment reuses it instead of forking another inline banner.

## 2. API

- `src/context/ToastContext.tsx` — `ToastProvider` (mounted once, in
  `app/layout.tsx`, inside `AuthProvider`) + `useToast()` hook returning
  `showToast(message: string, variant?: ToastVariant)`.
- `ToastVariant` is currently just `"success"` (the default) — the type is
  left open for a future `"error"`/`"info"` variant without an API change,
  the same way `CtaButton`'s `variant` prop grew incrementally.
- Multiple toasts stack (a plain array in the provider), each with its own
  independent lifecycle — calling `showToast` twice in quick succession
  shows two stacked pills, not a replace.

## 3. Visual design

- **Shape/surface** — `rounded-2xl` glass panel (`rgba(6,12,32,0.94)`,
  `blur(40px) saturate(140%)`, `surface-grain` texture), matching the
  panel language used by `RequestsPanel`/`CancelSpotDialog`/the spot-edit
  modals — not a new visual style.
- **Status spine** — a 3px solid left-edge bar, the same idiom already
  used three times in this app (`VenueSpotCard`'s meter spine,
  `RequestsPanel`'s per-request spine, `CancelSpotDialog`'s red warning
  spine), recolored to the site's one existing green: `#34d399` (already
  used as `.cta-free`'s accent for the free-price toggle — reused here
  rather than introducing a second green).
- **Icon** — a circular checkmark (`IconCheck`, `NavIcons.tsx`) that draws
  itself in via `stroke-dasharray`/`stroke-dashoffset` on a `pathLength="1"`
  path, rather than simply fading in — the one deliberately playful beat on
  an otherwise minimal component.
- **No gradients, no neon glow** — flat accent color on the spine/icon/ring,
  one soft directional drop-shadow for elevation (same technique as every
  other panel in this app). This is a locked rule across the whole design
  system, not new to this component.

## 4. Motion

Asymmetric in/out, on purpose — a bounce on the way in reads as a
"settling" confirmation; the same bounce on the way out reads as bouncy/
silly rather than confident, so the exit is a plain fade+drop instead.

| Phase | Duration | Easing | Effect |
|---|---|---|---|
| Enter | 320ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot) | fade in + translateY(14px→0) + scale(0.96→1) |
| Checkmark draw | 280ms, 120ms delay | ease-out | stroke-dashoffset 1→0 |
| Hold | 2.6s | — | static |
| Exit | 220ms | ease-in | fade out + translateY(0→8px) |

Both animations are guarded by `prefers-reduced-motion: reduce`
(collapsed to a 1ms duration / no checkmark draw), consistent with the
existing `page-enter` keyframe's own guard in `globals.css`.

Clicking a toast dismisses it immediately (skips straight to the exit
phase) rather than waiting out the hold.

## 5. Position

`fixed`, bottom-center, `z-[100]` (above every modal's `z-50`), padded by
`max(1.25rem, env(safe-area-inset-bottom))`. One position for both mobile
and desktop — avoids a responsive corner-swap and never competes with the
fixed navbar (top) or any modal, since a toast only ever fires after its
triggering modal has already closed.

## 6. Where it's used

- `EditSpotForm.tsx` (venue producer, `/home` dashboard) — "Changes saved
  successfully!" after a successful `POST /api/spots/:id/edit`. See
  `venue-dashboard.md` §5.4.
- `app/profile/edit/page.tsx` — "Changes saved successfully!" after a
  successful profile save, across all three save paths (comedian,
  venue_producer, and the shared legacy/admin path) — replacing the old
  inline `saveSuccess` green banner. `saveError` (still inline, since a
  failure needs to stay visible until the user acts, not auto-dismiss) and
  the separate password-change success message are unchanged by this pass.

## 7. Explicitly out of scope

- Error/info toast variants (type is ready for them, not built yet).
- A manual close (×) button — click-anywhere-to-dismiss covers it for a
  low-stakes, auto-dismissing confirmation.
- Toast queuing/max-visible limits — unlikely to matter at this app's
  scale of simultaneous saves; stacking is unbounded today.

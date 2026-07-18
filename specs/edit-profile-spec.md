# Spec: Comedian Profile Edit (`/profile/edit`) — Final

Scope: comedian role only. venue_producer and admin edit flows are explicitly
out of scope and must not be modified or broken by this work.

## 1. Background — reconciling with existing code

An implementation already existed at `apps/web/app/profile/edit/page.tsx`
before this spec, shared by all three roles. It conflicted with the product
decisions below in several ways (editable Full Name, a dead `Username` field
with no backing column, no phone/bio/social inputs, password validation
missing the new != current check). This spec supersedes that implementation
for the **comedian** render path only. The venue_producer/admin render path
keeps its current behavior unchanged (Full Name, City, Venue Name, Password),
reached via an explicit role branch rather than shared logic.

## 2. Field editability table (comedian)

| Field | DB column | Status | Notes |
|---|---|---|---|
| Full Name | `users.name` | Permanent | Identity; captured at signup only |
| Email (auth) | Supabase Auth | Permanent | Identity; never duplicated as editable |
| Password | Supabase Auth | Editable, validated | See §4 |
| Phone | `users.phone` | Editable | Regex `^\+?[0-9]{10,15}$` |
| Bio | `users.bio` (new) | Editable, optional | Max 500 chars |
| Contact Email | `users.contact_email` (new) | Editable, optional | Public contact address, distinct from auth email |
| YouTube link | `users.youtube_url` (new) | Editable, optional | |
| X (Twitter) link | `users.x_url` (new) | Editable, optional | |
| Instagram link | `users.instagram_url` (new) | Editable, optional | |
| City | — | **Removed entirely, comedian has no city concept** | See §6 |
| Username | — | **Removed entirely, never existed as real data** | Dead field in old code, deleted |
| Profile picture | `users.profile_picture` | Permanent, non-interactive | Static initials avatar shown, no upload UI |
| id, role, is_active, created_at | `users.*` | Permanent | Auth/authorization/audit — never client-writable, enforced server-side (§5) |

## 3. Migration

New file: `apps/api/src/db/migrations/001_comedian_profile_fields.sql`
(applied manually to Supabase, same as the rest of `apps/api/src/db/`):

```sql
ALTER TABLE users
  ADD COLUMN bio text CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD COLUMN contact_email text CHECK (contact_email IS NULL OR contact_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  ADD COLUMN youtube_url text CHECK (youtube_url IS NULL OR youtube_url ~* '^https?://'),
  ADD COLUMN x_url text CHECK (x_url IS NULL OR x_url ~* '^https?://'),
  ADD COLUMN instagram_url text CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://');
```

All five columns are nullable, no default, shared on the `users` table (not
comedian-exclusive at the DB level — venue_producer/admin rows simply never
populate or surface them from the UI).

## 4. Password change validation

Existing flow (kept): re-authenticate via `supabase.auth.signInWithPassword`
with the current password to prove it's correct (Supabase never exposes the
old hash for a raw comparison), then `supabase.auth.updateUser({ password })`.

**Added rule**: reject if `newPassword === currentPassword`, checked as a
plain client-side string comparison before firing the reauth call. This is
safe because by submit time the user has typed both plaintext values into
the browser themselves — no hash access is needed or possible. This is a
UX/product rule, not a security boundary, and is client-side only (the API
never sees either password in this flow).

## 5. API: new authenticated PATCH endpoint (Option B)

`apps/api/src/index.ts` gets:

- `requireUser` middleware: reads `Authorization: Bearer <token>`, verifies
  it via `supabase.auth.getUser(token)` (anon client), and attaches the
  verified user id to the request. Requests without a valid token get 401.
  This is the first authenticated route in the API — no prior middleware
  pattern existed to reuse.
- `PATCH /api/users/me`, gated by `requireUser`:
  - Server-side whitelist: `phone`, `bio`, `contact_email`, `youtube_url`,
    `x_url`, `instagram_url`. Any other key present in the request body
    (`name`, `full_name`, `email`, `role`, `id`, `is_active`,
    `profile_picture`, `city`, `username`, etc.) causes a `400` rejection —
    explicit reject, not silent drop.
  - Validates `phone` against the DB regex, `bio` length, and that URL
    fields look like `http(s)://...` when present; empty strings are
    normalized to `null` (clears the field) rather than being persisted as
    empty strings.
  - Writes via `supabaseAdmin` (service-role, bypasses RLS) with
    `.eq('id', <id from verified token>)` — the row is scoped by the
    server-verified identity, not anything client-supplied, so this does
    not rely on RLS for correctness per the instruction to not lean on RLS
    alone.
  - Returns the updated row (whitelisted columns only).

**Known residual gap, explicitly not fixed in this pass**: the browser's
anon Supabase client can still reach `users` directly (RLS's
`users_update_own` policy has no column-level restriction, and tightening it
would require a `REVOKE`/`GRANT` change on the shared `users` table that
also governs the venue_producer/admin direct-write path currently in
production use — out of scope, and risks breaking flows this spec must not
touch). The new PATCH endpoint is what the comedian edit page will call; it
does not retroactively lock the old anon-client write path.

## 6. City removal (comedian only)

`users.city` remains in the DB schema unchanged (`NOT NULL DEFAULT 'Delhi'`)
because it's a single shared table also used by venue_producer, and
venue-related schema/signup/dashboard code is explicitly out of scope here.
Removing the column would require touching that shared table's constraints
in a way that risks the venue_producer path — not done.

Instead, city is removed from every comedian-facing *code path*:
- Comedian signup form (`apps/web/app/auth/page.tsx`): city field/state
  deleted, `signUpComedian` no longer accepts or sends a `city` param.
- `AuthUser.city` (`apps/web/src/lib/auth.ts`) becomes optional
  (`city?: string`) instead of required, since venue_producer/admin still
  populate it. `signInUser` only sets `city` on the returned `AuthUser` when
  `profile.role !== 'comedian'` — comedian sessions simply never carry a
  `city` value.
- Comedian profile display (`ProfileHeader.tsx`, `ProfileDetailsCard.tsx`):
  city row/line removed.
- `/profile/edit` comedian form: no city input.

Note: no `ARCHITECTURE.md` file exists in this repository (checked before
writing this section) — the instruction to consult it for venue city/state/
country rules is satisfied instead by the untouched `venues` table schema in
`apps/api/src/db/schema.sql`, which already carries its own `city`/`state`/
`country` columns independent of `users.city`.

## 7. Username removal (comedian only)

Deleted outright, not just hidden, wherever it touched the comedian flow:
- `AuthUser.username?` field.
- `signUpComedian`'s `username` param and its use in the signup form.
- The `Username` input in `/profile/edit`.
- The `Username` row in `ProfileDetailsCard`.

`AuthUser.venueName?` is untouched — still required by the venue_producer
flow.

## 8. Navbar name truncation

Shared helper, not inlined in the component: `apps/web/src/lib/formatName.ts`

```ts
const MAX_DISPLAY_NAME_LENGTH = 8;
const TRUNCATED_NAME_LENGTH = 4;

export function getDisplayFirstName(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  if (firstName.length <= MAX_DISPLAY_NAME_LENGTH) {
    return firstName;
  }
  return `${firstName.slice(0, TRUNCATED_NAME_LENGTH)}..`;
}
```

`"Admin"` (5 chars) → `"Admin"` unchanged. `"Abcdefghij"` (10 chars) →
`"Abcd.."` (first 4 chars + two literal periods, not the `…` glyph).
`Navbar.tsx` calls this instead of its current bare `user.name.split(' ')[0]`.

## 9. Frontend reuse

- Avatar treatment reused from `ProfileHeader.tsx` (initials circle,
  `bg-[#38bdf8]/20`, cyan ring/glow) instead of the edit page's old
  solid-fill variant — now fully non-interactive, the "Change Photo" button
  and its "coming soon" alert are deleted, not disabled.
- `content-glass rounded-3xl` card container and existing input/label
  styling kept as-is.
- Comedian and venue_producer/admin now render from an explicit role branch
  in the same file rather than one shared form, so future changes to one
  don't silently affect the other.

## 10. Brutalist input styling (`BrutalistField.module.css`)

Scoped entirely to `apps/web/app/profile/edit/BrutalistField.tsx` +
`BrutalistField.module.css`, shared by every field on this page via the
`BrutalistField` wrapper component (not duplicated per field).

- Accent color (label tag background, hover shadow accent): `#38bdf8`
  (site primary cyan), replacing an original `#e9b50b` gold that clashed
  with the dark/cyan theme used elsewhere on the site.
- Border weight: `.container` border `2px solid #000` (was `4px`),
  `.field` border `2px solid #000` (was `3px`) — thinner, still a visible
  deliberate outline.
- Offset drop-shadow (`.container`'s `box-shadow: 10px 10px 0 #000`) kept
  unchanged; only the hover-state accent color swapped to cyan.
- The soft red gradient glow (`.shadow`, blurred `rgba(255,107,107,...)`
  gradient behind each box) is intentionally left as-is — flagged as a
  gradient inconsistent with the site's flat-color rule, but out of scope
  for this pass per product decision.

## 11. Out of scope, left for later

- Displaying bio/social links on the `/profile` view itself — that page's
  redesign is tracked separately in `profile-spec.md`, which explicitly
  defers `/profile/edit` and treats bio/social links as its own future
  candidate content. This pass only makes the fields editable and
  persisted; not shown back on `/profile`.
- Tightening `users` RLS/column grants (see §5's residual gap).
- The pre-existing `user_role` enum mismatch (`venue_owner` in the DB vs
  `venue_producer` in app code) — unrelated to comedian scope.

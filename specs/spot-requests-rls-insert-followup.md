# Follow-up: `spot_requests_insert_own` RLS policy is too permissive

Status: **known issue, not fixed.** Found 2026-10-10 while implementing
"one accepted spot per comedian per show" (specs/venue-dashboard.md §10).
Deliberately left out of that task; to be decided before deploy.

## The issue

`apps/api/src/db/migrations/006_spots_rls.sql`:

```sql
CREATE POLICY "spot_requests_insert_own"
  ON spot_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = comedian_id);
```

The only condition is that the row belongs to the caller. Nothing constrains
the other columns. If the `authenticated` role has INSERT privilege on the
table (Supabase's default grants normally do; **not verified against the live
project**), a signed-in comedian holding the public anon key and their own JWT
could insert a `spot_requests` row directly via PostgREST, bypassing
`apply_to_spot()`, with:

- `status = 'accepted'` (or `waitlisted`): self-acceptance without the venue
  owner. This also never decrements `spots.available_spots`, so counts drift.
- `decided_at`, `venue_message`, `edit_notice` set to arbitrary text that the
  owner or comedian UIs would render.
- a `spot_id` for a cancelled or already-passed spot (checks that live only in
  `apply_to_spot()`).

## What already limits it

- The web app never inserts into `spot_requests` from the browser. The only
  insert path in the code is `POST /api/spot-requests` → `apply_to_spot()`
  (service role). Nothing legitimate depends on the direct-insert policy.
- `idx_spot_requests_active_unique` (005) limits one active row per
  (spot, comedian).
- After migration `017b`, a second `accepted` row for the same (show, comedian)
  is rejected by the DB, which closes the "accepted twice" part. It does **not**
  stop a first self-acceptance.

## Options

1. **Remove the policy (recommended).**
   `DROP POLICY "spot_requests_insert_own" ON spot_requests;`
   All legitimate inserts go through the API with the service role, which
   bypasses RLS. Smallest, safest change; also revoke the table-level grant for
   good measure: `REVOKE INSERT ON spot_requests FROM authenticated, anon;`.
2. **Tighten the policy** if direct inserts must stay possible:
   `WITH CHECK (auth.uid() = comedian_id AND status = 'pending' AND decided_at IS NULL AND venue_message IS NULL AND edit_notice IS NULL AND edit_notice_at IS NULL)`.
   Stops self-acceptance but still skips the cancelled/past-spot checks in
   `apply_to_spot()`.
3. **Trigger-based force**: a `BEFORE INSERT` trigger that sets
   `status := 'pending'` and nulls the other fields. Works for any insert path,
   but hides rather than rejects bad input.

## Suggested verification before and after

- Before: using a comedian JWT and the anon key, attempt
  `POST /rest/v1/spot_requests` with `status: 'accepted'`. If it succeeds, the
  issue is live.
- After: the same call is rejected; `POST /api/spot-requests` still works; the
  existing and new scenarios in specs/venue-dashboard.md §10 still pass.

Related: also review whether `UPDATE`/`DELETE` privileges are granted to
`authenticated` on this table (no policy permits them today, so RLS should
deny, but confirm against the live grants).

## Verified live, 2026-11-08 (during payments Step 1, diff 1a)

With a comedian login and the anon key, `POST /rest/v1/spot_requests` with
`status: 'accepted'` **succeeded**: the issue is live. A direct `UPDATE` as the
comedian affected 0 rows (no update policy), so that half is closed. Migration
029 does not make the hole worse (forged price and cutoff columns are
overwritten by the trigger, and an insert for a show that has already ended is
refused), but a comedian can still accept themselves into a spot without the
owner, and the resulting accepted request would be billable once billing
exists. **Fix it before any real money flows** (option 1 above is still the
recommendation); it is its own task, not part of 029. The test row was a
`TEST – ` fixture and was deleted.

## Fix written, 2026-11-08 (not yet applied)

`apps/api/src/db/migrations/029b_close_spot_requests_direct_writes.sql` is
option 1: it drops `spot_requests_insert_own` and revokes every table privilege
on `spot_requests` from `PUBLIC, anon, authenticated`, then grants `SELECT` back
to `authenticated` so the two read policies keep working. It aborts if the end
state is not exactly that. Checked first: the web app never reads or writes the
table through the Supabase client, the API only uses the service-role client
for it, and every function that writes it is SECURITY DEFINER. Offline test on
PGlite with real roles and RLS: 11 checks, 0 failed. After the user applies it,
repeat the live check above (the comedian insert must now be denied) and the
apply / accept / cancel flows through the API.

## Applied and verified live, 2026-11-08: closed

The user applied `029b_close_spot_requests_direct_writes.sql`. Live check with a
comedian login through PostgREST: insert (accepted or pending), update and
delete are all denied or affect nothing, and no row was created. Reads still
work as intended (own rows, owner's rows for their spots, nothing for anon or
another comedian). Apply, accept, waitlist promotion, cancel, venue-cancel,
`update_show`, `cancel_show` and suspend/unsuspend all still work. 25 checks,
0 failed; the fixtures were deleted. Status of this follow-up: **closed**.

# Handoff: payments (weekly billing), Step 1 complete

Written 2026-11-08 and kept up to date through the whole of Step 1; last updated at the end of that session, when the user confirmed that everything works in the browser. For a brand-new session with no context. Everything below was checked in the repo; "not verified" marks what was not. **Do not touch any file until the user says "go".** The user commits; never stash, reset or check out uncommitted work (use `git diff` / `git show`).

Location: `specs/handoff.md`, because the earlier handoffs (`specs/handoff.md`, `specs/handoff-6b.md`) lived there until they were deleted in `aaa600c`. Move it if the user prefers the repo root.

## 0. Progress at the end of the session (2026-11-08)

**Step 1 of the payments work is COMPLETE.** It needed no Razorpay connection. Nothing from Steps 2 to 11 exists yet (no billing tables, no Razorpay code, no env vars, no new dependencies).

| Part | What it is | Verified |
|---|---|---|
| 1a, migration `029` | Venue cancellation cutoff (`venues.cancel_cutoff_hours`, 0 to 12, default 12); price and cutoff **locked on each request when it is accepted**; request-time price kept as evidence only; late cancels of accepted spots refused; accepting for an ended show refused with a clean message; back-fill of the 2 existing accepted requests | Applied by the user. **53 live checks, 0 failed** |
| `029b` | Closes the `spot_requests_insert_own` hole (a comedian could insert an `accepted` row themselves). Drops the policy and revokes write privileges from `anon` and `authenticated` | Applied by the user. **25 live checks, 0 failed** |
| 1b, API and types | `PATCH /api/venues/mine/cancel-cutoff`; the cutoff on the owner status, public venue and admin venue routes; locked price, locked cutoff, `cancel_by` and the venue's current cutoff on `/api/spot-requests/mine` | **51 live checks, 0 failed**; API ad hoc `tsc` shows only the 13 old errors; web `check-types` passes |
| 1c, web | Owner "Cancellation window" section; cutoff note and per-card line on the venue page (before Apply); locked price and "cancel until" on the request card, Cancel button hidden once closed; "host pays" note in the show forms; read-only row in the admin dossier; new states on the debug preview page | Type-check, lint, 29 helper checks, dev-server render. **The user checked it in a browser: everything works** (flows and widths not itemised) |

Test fixtures were `TEST – ` rows created with the service role and deleted after every run (0 users and 0 venues left each time); real data stayed at 31 requests, 11 venues. The test scripts lived in the session scratchpad and are **not in the repo**.

### Files from Step 1 (ALL UNCOMMITTED; the user commits)
- New: `apps/api/src/db/migrations/029_request_price_snapshot_and_cancel_cutoff.sql`, `029b_close_spot_requests_direct_writes.sql`, `apps/web/src/lib/cancelWindow.ts`, `apps/web/src/components/venue-dashboard/CancellationWindowSection.tsx`, `specs/payments-weekly-billing.md`, `specs/handoff.md`.
- Edited: `apps/api/src/index.ts`, `packages/types/index.ts`, `apps/web/app/venues/[id]/page.tsx`, `apps/web/app/debug-spot-card-preview/page.tsx`, `apps/web/src/components/{admin/VenueProfilePanel,dashboard/RemindersSection,dashboard/SpotRequestCard,venue-dashboard/AddShowForm,venue-dashboard/EditShowForm,venue-dashboard/SpotFormShared,venue-dashboard/VenueProducerDashboard}.tsx`, `apps/web/src/hooks/useOwnerVenueStatus.ts`, `specs/decisions.md`, `specs/spot-requests-rls-insert-followup.md` (now marked closed).
- Already modified by the user before this work and not touched: `CLAUDE.md`, `README.md`, `specs/admin-venue-management.md`.

## 1. What is done and what is not

| Item | State |
|---|---|
| `specs/payments-weekly-billing.md` (design, Steps 0 to 11, test plan, Q1 to Q24) | **Written, uncommitted** (untracked). **Updated for Step 1** (decisions D7 to D10, price lock, venue cutoff, hosting and free spots, 1a/1b/1c records). Steps 2 to 11 are still the original design |
| Migrations, API, web, types for **Step 1** | **Done** (see section 0) |
| Anything for **Steps 2 to 11** (migrations 030 to 034, billing tables, Razorpay code, env vars, `express-rate-limit`, scheduler) | **Not started** |
| Step 0 (Razorpay spike) | **Not started.** The user is starting Razorpay KYC and the Route request themselves. Step 1 needs no Razorpay connection |
| Razorpay behaviour (field names, event names, fee rates) | **Unconfirmed**, docs-based only |
| Step 1 investigation and all open questions except N18, N19 | **Resolved** (sections 3 and 4) |
| Step 1 diff 1a (database) | **Done: written, applied by the user, and verified live on 2026-11-08** (53 checks, 0 failed, fixtures deleted, real data unchanged). `apps/api/src/db/migrations/029_request_price_snapshot_and_cancel_cutoff.sql` is untracked (the user commits). Record in the spec's Step 1 section |
| Step 1 diff 1b (API, types) | **Done 2026-11-08: built and verified live** (51 checks, 0 failed, fixtures deleted). Edits in `apps/api/src/index.ts` and `packages/types/index.ts` (uncommitted). New route `PATCH /api/venues/mine/cancel-cutoff`; new fields listed in the spec's Step 1 section. Static checks: API ad hoc tsc = the 13 old errors only, web `check-types` passes, `/api/health` ok |
| **Insert-hole fix (029b)** | **Closed 2026-11-08: applied by the user and verified live** (25 checks, 0 failed, fixtures deleted). `apps/api/src/db/migrations/029b_close_spot_requests_direct_writes.sql` is untracked (the user commits). A comedian can no longer insert, update or delete `spot_requests` directly; reads and every API flow still work. Recorded in the spec's Step 1 section and in `specs/spot-requests-rls-insert-followup.md` (closed) |
| Step 1 diff 1c (web) | **Done 2026-11-08: built, statically checked, and confirmed by the user in a browser ("everything works").** New: `apps/web/src/lib/cancelWindow.ts`, `apps/web/src/components/venue-dashboard/CancellationWindowSection.tsx`. Edited files are listed in section 0. Not done by me: `next build` (the dev server was on :3000); individual flows and widths the user checked were not itemised |
| Audit trail | **Discussion delivered** (section 6). Not yet in the spec; goes in once agreed |

## 2. Decisions already made (spec section 3 unless stated)

| Decision | Where |
|---|---|
| Razorpay gateway (D1); Route with linked accounts (D2); commission 0% as bps with global default + per-venue override (D3); venue bears the gateway fee (D4) | spec section 3 |
| Weekly billing of accepted spots; manual clear (paid offline / waived) by owner and admin; dues-blocking policy chosen by owner, overridable by admin (D5) | sections 3, 8, 9 |
| Email deferred, System 1 out of scope (D6) | sections 3, 16 |
| Pending-dues rule: effective policy = admin override > owner choice > global default; blocked = strict + overdue sent bill + no exception | section 8 |
| Decisions of 2026-11-08 (sections 3 and 4 of this file) | **Now in the spec**: section 3 rows D7 to D10, section 4.3, section 5 migration 029, section 10, Q2 and Q3, and the Step 1 section |

## 3. User answers, round 1 (2026-11-08)

| # | Answer | Effect |
|---|---|---|
| 1 | Cancel cutoff is **venue-configurable**, chosen by the owner: default and maximum 12 h before start, minimum 0 h | Replaces the global 12 h |
| 2 | Price ceiling stays a SQL constant in 029, with an explicit Step 3 task to re-point it at `billing_settings` | The only accepted "undo later" item |
| 3 | A late cancel is refused outright, no flag logic | As in the spec |
| 4 | An ended-show accept must give a clean message to the owner | See N16 |
| 5 | Hosting and free spots are billed like any spot (free at ₹0); snapshot every request | Reverses spec wording (section 5) |
| 6 | Billed price = the price locked when the request is **accepted**; back-fill from current price is fine | Replaces "lower of request-time and accept-time" |
| 7 | Back-filled rows are normal for billing; marker kept only as data | No billing or UI effect |
| 8 | No API-level price validation in Step 1 | 029 stays DB-focused |
| 9 | Cutoff uses `date + start_time`, show-ended uses `date + end_time`, both IST | |
| 10 | Implement only what needs no Razorpay connection | |
| 11 | 029 is applied as soon as it is written. Site not deployed, but a finished product is wanted: no throwaway shortcuts | |
| 12 | Verification record in the payments spec plus a short `decisions.md` entry | |

## 4. User answers, round 2 (2026-11-08): all Step 1 questions resolved except N18 and N19

| # | Resolution |
|---|---|
| N1 | The cutoff is a venue setting: `venues.cancel_cutoff_hours smallint NOT NULL DEFAULT 12 CHECK (BETWEEN 0 AND 12)` (a column on `venues`; the CHECK is the real guard because `venues_owner_update_own` lets owners write any column through PostgREST). Public-readable |
| N2 | The value is **copied onto each request at accept** (`cancel_cutoff_hours_at_accept`); later owner changes never affect an accepted request. Pre-029 accepted rows are back-filled from the venue's current value. |
| N3 | Whole hours 0 to 12 only. Cancelling an accepted request is **never** allowed after the show's start time, even at 0 h |
| N4 | Dedicated owner route (not the string-only `applyVenueEditableUpdates`); control on the owner dashboard (component chosen at plan time); allowed in any venue state; no Sidebar change |
| N5 | Admin: read-only display in the dossier now; override or lock deferred |
| N6 | **The cutoff must be shown to the comedian before they request a spot**, so a late-cancel refusal is never a surprise (venue detail page spot cards and the apply action; the accepted card shows the locked cutoff and the exact deadline). The refusal message names the cutoff and the time |
| N9 | An all-₹0 week creates no bill; ₹0 lines ride on a bill whose total is above 0 |
| N10 | Free (price NULL or 0) snapshots **0**. Invalid (above the ₹10,000 ceiling, more than 2 decimals) snapshots **NULL**, is excluded from billing and flagged |
| N11 | Hosting copy: owners are told the host pays the hosting price (helper text in the show form). **Plus: a bill must show, for every charge, the show, venue, date and spot type (including hosting)** so the comedian knows what each charge is for. This lands in Step 2/3 and Step 6 (line snapshots carry venue name, date, start and end time, spot type, label; Step 1 only has to keep the data available) |
| N13 | `price_paise_at_request` is kept as **evidence only**; billing uses `price_paise_at_accept` |
| N14 | Show the locked price on the accepted request card (`/api/spot-requests/mine` returns it). `update_show` is left alone |
| N15 | Back-fill accepted rows only (pending and waitlisted get their price at their own accept). `price_source` (`trigger` / `backfill`) is data only: no billing effect, no review marker |
| N16 | **Yes, edit `accept_spot_request` in 029.** Exact change below |
| N17 | No audit table until 030 |
| N18 | **Still open** (Supabase plan and venue counts). Not determinable from the repo (no Supabase config file; the plan is not in any tracked file; `apps/api/.env` was deliberately not opened). Section 6 gives estimates for both tiers instead |
| N19 | **Still open**, with the user's accountant. Design requirement: the retention period must be easy to change later (section 6) |

### Exact change to `accept_spot_request` (N16)

The body is the 017a version, byte for byte, except for one block inserted immediately **after** the `spot_cancelled` check and **before** the `not_pending` check (all locks are taken, no row has been written yet):

```sql
IF NOT venue_show_is_upcoming(v_spot.date, v_spot.end_time) THEN
  RETURN json_build_object('success', false, 'code', 'show_ended',
    'error', 'This show has already ended, so the request can no longer be accepted.');
END IF;
```

- Same signature (so `CREATE OR REPLACE`, no `DROP`, grants are kept; REVOKE/GRANT is restated anyway).
- The **price lock and the cutoff copy are NOT in the function.** They live in the BEFORE trigger, so every path that sets `accepted` (the RPC, a swap, a waitlist promotion, the direct-insert hole, the SQL editor) is covered. The function stays a 7-line change.
- A BEFORE trigger on `spot_requests` also refuses an ended-show accept (backstop for the paths that skip the function). It does not depend on `show_id` (looks up `spots` via `spot_id`), because same-event triggers fire alphabetically.
- Step 8 replaces this function again; that is expected.
- To be verified in the plan phase: a `diff` of the new function text against 017a shows only those lines; the 017/020 checks are re-run.

## 5. Spec sections that need updating when the user says "go" (nothing edited yet)

Hosting and free spots billed (answer 5, N9, N10):
- section 2 lines ~56 and ~62 (host pays, now decided); section 4.2 rule 5 and the hosting sentence; Q2 in section 17.
- section 4.3 (separate free = 0 from invalid = NULL).
- section 5 `bill_lines`: `amount_paise (> 0)` becomes `>= 0`; line snapshots must include venue name, date, start and end time, spot type (N11).
- section 6 generation row and draft to sent ("total > 0" stays for the bill, not per line).
- section 10 ("Zero-amount or free week", "Sub-minimum bill"); section 13 Step 3 acceptance (free spots); section 14 demo script; Step 6 and Step 7 UI (every charge shows show, venue, date, spot type).

Price lock at accept (answer 6, N13, N15):
- section 1 row 2; section 4.3 (billed amount = `price_paise_at_accept`, request-time price is evidence only); section 5 migration 029 (trigger text, back-fill scope, `price_source` marker without a review marker); section 10 ("Price edited while request pending"); section 13 Step 1 acceptance.

Venue cutoff (answer 1, N1 to N6):
- section 1 row 3; section 5 migration 029 and `billing_settings` (remove `cancel_cutoff_hours`); section 10 ("Comedian cancels an accepted spot"); section 13 Step 1 (files, API, UI, risks; "Deferred: owner-set per-venue cutoff" is now in scope); section 16; Q3.

Ended-show accept (N16): section 13 Step 1 "Do not touch: `accept_spot_request` internals" and the Step 1 file list. Also note that Step 1 now touches API and web (the spec said only the request card).

Also: `decisions.md` entry; the Step 3 task "re-point the price ceiling at `billing_settings`"; the audit-trail section once agreed.

## 6. Audit trail (discussion, not yet in the spec)

Assumptions: 8 accepted spots per show; ₹150 spots; 3 to 4 spots per comedian per week (3.5), so bills per week ≈ 8 × shows ÷ 3.5. An audit row ≈ 0.6 KB with indexes; a stored webhook event ≈ 4 KB with payload (≈ 0.4 KB once stripped); ≈ 10 audit rows per bill and 2 per request; ≈ 4 webhook events per online payment; bills, lines, payments and notifications ≈ 4.6 KB per bill plus 0.4 KB per request. Venue counts assume ≈ 2 shows per venue per week (an assumption, not data).

| Case | Venues | Shows/wk | Bills/wk | MB/week | MB/month | MB/year (payloads kept) | MB/year (payloads stripped at 90 d) |
|---|---|---|---|---|---|---|---|
| Pilot | 1 | 2 | 5 | 0.15 | 0.6 | 8 | 7 |
| Small | 5 | 10 | 23 | 0.74 | 3.2 | 38 | 25 |
| Medium | 25 | 50 | 114 | 3.7 | 16 | 190 | 126 |
| Large | 100 | 200 | 457 | 14.6 | 63 | 760 | 505 |

`billing_events` alone: about 2, 12, 60 and 240 MB per year.

Time until a budget is used (budget = half of the plan's disk, minus an assumed ≈ 100 MB already used on Free; payloads stripped):

| Case | Free (≈ 500 MB, budget ≈ 200 MB) | Pro (≈ 8 GB, budget ≈ 4 GB) |
|---|---|---|
| Pilot | decades | decades |
| Small | ≈ 8 years | decades |
| Medium | ≈ 19 months | ≈ 30 years |
| Large | ≈ 5 months (≈ 3 raw) | ≈ 8 years |

Plan facts are general knowledge, **not verified for this project**: Free is about 500 MB, no backups, pauses when idle, and (as I understand it) goes read-only when the disk is full, which would stop webhooks applying payments. Pro is about 8 GB included with daily backups and automatic disk growth billed per GB. Real money should not sit on Free regardless of size; Render paid and Vercel Pro are already prerequisites in the spec, so Supabase Pro belongs with them. To learn the real size: `select pg_size_pretty(pg_database_size(current_database()));` in the SQL editor.

Recommended retention (N19 pending the accountant): webhook payloads 90 days, then keep only event id and type; read notifications 90 days; `billing_events`, `bills`, `bill_lines`, `billing_payments` online at least 24 months and never deleted without a verified export.

Design for an easy change of retention: every period is a **settings value, not code**: `billing_settings` gets `webhook_payload_retention_days` (90), `notification_retention_days` (90), `audit_archive_after_months` (24; NULL = never archive). One prune/archive function reads them and is scheduled in Step 10; archiving exports first and deletes only after the export is confirmed. Plain tables with a `created_at` index (no partitioning) are enough at these volumes (the Large case is about 400,000 audit rows a year); revisit partitioning only past millions of rows.

Near the limit: review at 50% of disk, archive at 70%, upgrade or add disk at 85%; the admin billing page shows database size against the plan.

At Step 1 (no payments yet): no audit table (N17). The evidence is on the row: `price_paise_at_accept`, `price_paise_at_request` (evidence), `accepted_at` (019), `cancel_cutoff_hours_at_accept`, `price_source`. Refusals (late cancel, ended-show accept) are not recorded until 030. The Step 1 verification record in the spec holds the one-time facts (back-fill counts, test results). The new columns add well under 0.1 KB per request.

## 7. Repo state relevant to payments (2026-11-08)

- Branch `main`, HEAD `aaa600c implemented all admin features`.
- Uncommitted: modified `CLAUDE.md`, `README.md`, `specs/admin-venue-management.md`, `specs/decisions.md`; untracked `specs/payments-weekly-billing.md` and this file. None is payments code.
- **Latest migration: `028_admin_venue_stats.sql`, applied.** Next is **029**.
- System 2: `venue_shows`, `spots` (one row per pool with copies of `date`, `start_time`, `end_time`, `price numeric`, `venue_producer_id`), `spot_requests` (005; `show_id` 017a; `accepted_at`, `cancelled_from_status` 019).
- Current definitions: `comedian_cancel_spot_request(uuid,uuid)` = 016; `accept_spot_request(uuid,uuid,text,uuid)` = 017a; `apply_to_spot` = 007; `venue_show_is_upcoming(date,time)` = 021 (IST, uses `end_time`); `update_show` = 015 (edits `spots.price` and `date` in place; edit notice only for accepted and waitlisted). Triggers on `spot_requests`: `trg_spot_requests_operating_gate` (020), `_set_show_id` (017a), `_track_status` (019).
- A venue is found from a spot by `venues.owner_id = spots.venue_producer_id` (one venue per owner assumed repo-wide).
- API: spot-request routes `index.ts` ~1742 to 1820; `GET /api/venues/:id` (~257) selects venue columns by an explicit list and returns `{ venue, shows, spots }`; `PATCH /api/venues/mine` (~517) uses the string-only `validateVenueFields`. Web: `app/venues/[id]/page.tsx` (apply), `useMySpotRequests.ts`, `RemindersSection.tsx` (shows the error string), `SpotRequestCard.tsx` (shows no price), `useSpotRequests.ts` (passes `code`; how `RequestsPanel` renders an unknown code is not verified).
- No payment code except the unrelated legacy System 1 `bookings.payment_*` columns. No `express-rate-limit`, no Razorpay package or env vars, no scheduler.
- Live grants on `spot_requests` for `authenticated`: **not verified**.

## 8. Step 1 outline (all done; kept as a record)

Three diffs, each ending with spec update, `git diff --stat`, and a plain verified / not-verified report, each waiting for "go":
- **1a Database:** `029_request_price_snapshot_and_cancel_cutoff.sql` (columns, `venues.cancel_cutoff_hours`, back-fill, price and cutoff triggers, ended-show trigger, replaced cancel RPC, the 7-line `accept_spot_request` change). The user applies it; live checks with `TEST – ` fixtures, 017/020 re-run.
- **1b API and types (DONE):** owner cutoff route, cutoff exposed on the public venue, owner status and admin detail routes, locked price, locked cutoff, `cancel_by` and the venue's current cutoff on `/api/spot-requests/mine`, types only in `packages/types`. Fields the web (1c) can use: `OwnerVenueStatus.cancel_cutoff_hours`, `Venue.cancel_cutoff_hours`, `AdminVenueDetail.cancel_cutoff_hours`, and on `SpotRequest`: `price_paise_at_accept`, `cancel_cutoff_hours_at_accept`, `cancel_by`, `venue_cancel_cutoff_hours`. Refusals come back with HTTP 200, `success: false`, a `code` and a readable `error`.
- **1c Web:** owner cutoff control, cutoff shown before a request, accepted card (locked price, cancel-by time), refusal and ended-show messages, hosting helper text.

## 9. Next action for the following session

The user ended the session here on purpose. Step 1 is finished; nothing is half-done.

1. Read this file and the spec's Step 1 section (it holds the full verification records).
2. Ask the user what to do next. The natural options, in the spec's order:
   - **Step 0** (Razorpay spike: test-mode account, Route, a Payment Link with a transfer, record the real field and event names and fee rates). The user said they are starting the Razorpay KYC and Route request themselves, so ask where that stands. It needs their account and keys; it writes no repo code.
   - **Step 2** (billing foundation, migration **030**: all tables, enums, constraints, immutability and audit triggers, RLS, billing off). Pure database work, needs no Razorpay connection. Plan in chat, wait for "go", then a second "go" before code. Remember when writing it: the audit table arrives here (decision N17), the `bill_lines` snapshot fields must include venue name, date, start and end time and spot type, `amount_paise >= 0`, and the retention periods are settings (section 6).
   - **Step 3 reminder:** re-point the ₹10,000 price ceiling (currently a constant inside `price_to_paise()` from 029) at `billing_settings.max_spot_price_paise`. This is the one accepted "undo later" item.
3. Still open, none blocking: **N18** (the user's Supabase plan and venue counts; section 6 has estimates for both tiers) and **N19** (retention periods, to be confirmed with the user's accountant; **Q1**, the tax question, must also be answered before Step 11). The audit-trail section (section 6) is a discussion only and is **not yet in the spec**; add it once the user agrees.
4. Housekeeping the user may want: commit the Step 1 files (section 0); `CLAUDE.md` still says migrations are `001…028` and does not mention `029` / `029b` (it is one of the user's uncommitted files, so change it only if asked).
5. Standing rules from `CLAUDE.md`: one step at a time, plan in chat first and wait for "go", update the spec with the code, show `git diff --stat`, say plainly what was and was not verified; the user commits; never stash, reset or check out uncommitted work. Live checks use `TEST – ` fixtures and the service role, and everything is deleted afterwards including `users` rows.

### Notes from writing 029 (2026-11-08)
- The inserted `show_ended` block in `accept_spot_request` is 8 lines (7 plus a blank line), verified by a text diff against 017a.
- `price_source` ended up defined as "how `price_paise_at_accept` was set; NULL while there is no lock" (not set on plain inserts). The spec says so.
- The trigger fires before `trg_spot_requests_operating_gate` (name order). Only the order of the error messages differs.
- Not covered by the offline test: the real 018/020/021 functions, Supabase roles/RLS, and the live `authenticated` grants on `spot_requests`.

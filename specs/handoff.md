# Handoff: payments (weekly billing), Steps 0 to 2 complete; resume at Step 3 planning

> ## ▶ RESUME HERE (written 2026-11-13, end of the session that finished Step 2)
> - **Exact resume point:** **Step 3 (migration 031: generation and lifecycle functions, plus thin API with `express-rate-limit`) has NOT been started and NOT been planned in chat.** Do this first: read this block, the spec's "PROGRESS AND PLANNING STATUS" banner, spec sections 4, 5 (migration 031), 6, 8, 9 and 12, and the "Migration 030 record" in section 13. Then write the Step 3 plan in chat and **wait for the owner's "go"** before writing any file.
> - **Planning coverage:** detailed plans were agreed and built for Steps 0, 1 and 2 only. Steps 3 to 11 exist only as the outline in spec section 13 plus the round 1 and round 2 decisions in the banners below.
> - **Git state: UNCOMMITTED, but the owner is about to commit it.** All Step 2 work is in the working tree (modified: `.gitignore`, `CLAUDE.md`, `apps/api/src/index.ts`, `apps/web/.gitignore`, `packages/types/index.ts`, `specs/decisions.md`, `specs/handoff.md`, `specs/payments-weekly-billing.md`; new: `apps/api/.env.example`, `apps/web/.env.example`, `apps/api/src/billing/config.ts`, `apps/api/src/billing/startup.ts`, `apps/api/src/db/migrations/030_billing_foundation.sql`). Last commit when this was written: `cd23e85` (Step 1). Run `git status` and `git log -3`: if clean, the commit happened. Never stash, reset or check out uncommitted work.
> - **Database state:** migration 030 is applied to the real Supabase project; billing is OFF (`billing_enabled=false`); all billing tables are empty except the one settings row; no billing function, API route or screen exists. Migration 031 is the next file and is unwritten.
> - **Step 3 must remember:** every new SQL function does `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and `GRANT ... TO service_role`; the guard triggers in 030 are always on, so functions must respect them (lines only on drafts, bills only created as draft, money frozen after send, audit rows append-only); re-point `price_to_paise()` at `billing_settings.max_spot_price_paise`; Route is not used (no transfer columns); the audit trail has fixed columns only; clearing requires `confirmed: true`; test fixtures use the `TEST – ` prefix and are deleted afterwards including `users` rows; keys only via `node --env-file=apps/api/.env`, never print or read the env file.
> - **Test tooling for reuse:** the offline PGlite harness and the live harness are in the 2026-11-13 session scratchpad (`/private/tmp/claude-501/-Users-jaivardhan-Downloads-Projects-open-mic-tracker/bf0ada43-1cf0-4b5a-aa9c-d302c870eb86/scratchpad/m030/test030.mjs` and `.../live/live030.mjs`); they are not in the repo and the folder may be gone, so recreate from the spec's Migration 030 record if needed.
> - **Priority reminder still due:** the refund retry on or after 2026-11-17 (block below).

> ## ⚠ REMINDER, PRIORITY: RETRY THE REFUND TEST ON OR AFTER 2026-11-17
> Tell the owner at the start of any session on or after **17 Nov 2026**. Test payment `pay_TzdeUhi84z8paK` (₹100, netbanking, link `plink_TzdWBY2IQriOCF`) was not settled and the balance was zero, so refunds returned `invalid request sent` from both the API and the dashboard. Retry: start the receiver and ngrok, `rz.mjs refund <pay_id> 10000`, then `fetch-refund`, and record `refund.*` events and the refund entity in the spec's "Step 0 record". If it still fails after settlement, ask Razorpay support. Do NOT use "Add Funds" (real money).

> ## SESSION STATE, end of session "connecting razorpay" (2026-11-13): READ THIS FIRST (supersedes the 2026-11-12 SESSION STATE block below)
> - **Step 0 spike is DONE except refunds.** All findings are in the spec's section 13, "Step 0 record". Keys work (regenerated pair, 200), all 9 webhook events are confirmed as named, `X-Razorpay-Event-Id` is present and unique, fee/tax, cancel, expiry, minimum amount and duplicate `reference_id` are recorded. UPI is not offered on this test account.
> - **Cleanup done:** receiver stopped, `captured.jsonl` deleted (it held test contact details). Spike scripts remain in the old scratchpad (`.../71217e2e-3c49-4999-9c90-2a10b9813435/scratchpad/spike/`: `lib.mjs`, `rz.mjs`, `receiver.mjs`; `rz.mjs create` now takes an optional 4th argument, a fixed `reference_id`, and `refund` sends no `notes`). If that folder is gone, recreate them from the description in the 2026-11-12 block below. The ngrok tunnel (`reusable-ploy-zap.ngrok-free.dev`, port 8788) is the owner's to start.
> - **Webhook URL:** the dashboard still points at `https://reusable-ploy-zap.ngrok-free.dev/webhook` (the throwaway receiver). At Step 4 change it to `/api/webhooks/razorpay` and point ngrok at the API port (8080, `PORT` in `apps/api/.env`).
> - **Step 2b DONE (2026-11-13)**: env templates, gitignore, `CLAUDE.md` env table, `apps/api/src/billing/config.ts` + `startup.ts`, start-up check wired into `index.ts`; record in the spec's Step 2 section (45 fake-env checks, ad hoc tsc 13 old errors, real dev and production starts). All uncommitted; the owner commits.
> - **STEP 2 COMPLETE (2026-11-13).** Migration `030_billing_foundation.sql` was applied by the owner and verified live: 160 checks, 0 failed, with `TEST – 030` fixtures through the real RPCs and real anon/user tokens, all deleted; real data unchanged (19 users, 11 venues, 11 shows, 19 spots, 31 requests). Offline test: 255 checks. Types-only additions are in `packages/types`; `CLAUDE.md` says migrations `001`…`030`. Record: the spec's section 13, "Migration 030 record". Test scripts are in the 2026-11-13 session scratchpad (`.../bf0ada43-1cf0-4b5a-aa9c-d302c870eb86/scratchpad/m030/test030.mjs` offline, `.../live/live030.mjs` live), not in the repo; recreate them from the spec record if needed.
> - **Not tested live:** deletion protection of REAL bills' rows (would leave undeletable rows; offline only); concurrency; the 017 swap, 020 gate, `update_show` and suspend flows were not re-run this time.
> - **Billing is still OFF** (`billing_settings.billing_enabled = false`); no billing API route or screen exists. **Next: Step 3** (generation and lifecycle functions, migration 031, plus thin API with rate limits). Plan it in chat first and wait for the owner's "go". Reminder still due: the refund retry on or after 2026-11-17.

> ## PLAN CHANGE, decided 2026-11-12 (read this first; it supersedes the wording below)
> - Razorpay onboarding and KYC have **NOT** been started. They are deferred until **after the site is deployed** (Razorpay needs a live site to verify; KYC and business details are permanent once submitted, so the owner will not submit until the product is finished and certain).
> - The owner has Razorpay **TEST** keys (`rzp_test_...`) generated without KYC. **Steps 2 to the last step are built and verified against Razorpay test mode.** Order: (1) build and test the whole payments system with test keys; (2) deploy; (3) only then onboarding/KYC and live keys.
> - **Test to live is a configuration change only** (keys, webhook secret, webhook URL via environment variables). Zero code changes.
> - **Superseded in this file:** "the user is starting Razorpay KYC", "no keys exist", "stubbed / deferred / blocked on Razorpay", the **fake-gateway proposal and the 4a/4b split in section 10.2 and 10.3 (S2-6, S2-8, S2-9)**, and "real adapter after keys". Section 10 stays as a record of that session; its recommendations no longer apply unless the owner re-adopts them.
> - Never print, log or commit the keys; they live in environment variables only. `.gitignore` and `.env.example` are the first implementation step.
> - Open and unconfirmed: Route eligibility and test-mode Route; real fees; live-only behaviour. Investigated in the 2026-11-12 session; findings are in chat and the questions await the owner's answers. No plan has been written.

> ## SESSION STATE, end of session "step 2 and ahead" (2026-11-12): SUPERSEDED by the 2026-11-13 block above (kept as a record; the 401 and the spike steps below are resolved, except refunds)
>
> **Where to continue:** Step 0 spike (part 2a of the Step 2 plan), at the step "create the first test Payment Link". It is **blocked by a 401 from Razorpay** (see "What failed"). Nothing of 2b (env scaffolding) or 2c (migration 030) has been started. The owner's "go" covered the spike only; **a second "go" is required on the 030 table design** after the spike results are in the spec.
>
> **Done this session (no repo code, no migration):** all decisions of rounds 1 and 2 are written into the banner of `specs/payments-weekly-billing.md`, the block below, and four entries at the end of `specs/decisions.md`. The Step 2 plan was written in chat (order: 2a spike, 2b env scaffolding, 2c migration 030) and the owner replied that the keys were added and to continue. Uncommitted: `specs/decisions.md`, `specs/handoff.md`, `specs/payments-weekly-billing.md` (the owner commits).
>
> **Spike progress (all in test mode, no Route):**
> - Scripts are in the session scratchpad `/private/tmp/claude-501/-Users-jaivardhan-Downloads-Projects-open-mic-tracker/71217e2e-3c49-4999-9c90-2a10b9813435/scratchpad/spike/` (not in the repo, no secrets in them): `lib.mjs` (every printed line passes through `out()`, which replaces env secret values and any `rzp_...` string with `[REDACTED]`; `rzp()` refuses a non-`rzp_test_` key), `rz.mjs` (commands: `check`, `create <paise> <minutes> [note]`, `fetch-link <id>`, `fetch-pay <id>`, `refund <pay_id> [paise]`, `fetch-refund <id>`, `cancel <id>`), `receiver.mjs` (throwaway webhook receiver, `POST /webhook` on 127.0.0.1:8788, verifies HMAC-SHA256 of the raw body, appends to `captured.jsonl` in the same folder, answers 200 only for a valid signature). If that folder is gone, recreate the three files to this description. Run as `cd <repo> && node --env-file=apps/api/.env <path>/rz.mjs <command>`.
> - First `check`: all four variables present, key id has the `rzp_test_` prefix, mode `test`, webhook secret long enough, and `GET /v1/payment_links?count=1` returned **200** (so Payment Links work in the owner's test account).
> - Receiver started on 8788: `/health` 200, an unsigned `POST /webhook` got 400 (that test post sits in `captured.jsonl` as `signatureValid:false`). **The receiver was stopped at the end of the session** (port 8788 is free); start it again in the new session.
> - ngrok: dev domain `reusable-ploy-zap.ngrok-free.dev`; `https://reusable-ploy-zap.ngrok-free.dev/health` returned 200 through the tunnel while the owner's `ngrok http 8788` was running and the receiver was up. The tunnel needs restarting by the owner (`ngrok http 8788`) in the new session.
> - Webhook created by the owner in the test dashboard: URL `https://reusable-ploy-zap.ngrok-free.dev/webhook`, the owner's own secret (same as `RAZORPAY_WEBHOOK_SECRET`), the nine events `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.authorized`, `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`, `refund.failed`. The owner said "saved" but did **not** report whether the dashboard's event names matched these (event names are from memory, unconfirmed).
> - Docs facts (Razorpay, via fetch, not yet confirmed by running): create-link fields `amount` (minimum 100 paise), `currency`, `accept_partial` (default false), `reference_id` (unique, max 40 characters), `description` (max 2048), `customer`, `expire_by` (at least 15 minutes ahead, at most 6 months), `notify`, `callback_url` and `callback_method` (`get`), `notes` (up to 15 pairs), `reminder_enable`; response has `id`, `short_url`, `status` (`created`, `partially_paid`, `expired`, `cancelled`, `paid`), `reference_id`, `expire_by`, `payments` (null until captured). The webhook docs URL I tried returned 404, so event names and payload shapes are still unknown. The fetch, cancel and refund endpoints in `rz.mjs` are from memory and **unverified** (`POST /v1/payment_links/:id/cancel`, `GET /v1/payment_links/:id`, `POST /v1/payments/:id/refund`, `GET /v1/refunds/:id`).
>
> **WHAT FAILED:**
> 1. `rz.mjs create 10000 30 first-success-test` returned **HTTP 401** `{"description":"Authentication failed","code":"BAD_REQUEST_ERROR"}`.
> 2. Re-running `rz.mjs check` straight after: the variables are still present with the right shape, but the read-only call that returned 200 earlier now returns **401** as well. So the credentials in `apps/api/.env` changed or were invalidated between the first check and the create. **Cause not determined.** Hypotheses, in order: the test keys were regenerated in the dashboard (for example while creating the webhook), which invalidates the old pair at once; `apps/api/.env` was edited after the first check (quotes, a space around `=` or a trailing space on a key line); Test Mode toggle unrelated (the prefix check passed). The owner was asked to check these and has not answered yet. The env file was never opened by me, and no key or secret value was printed at any point.
> 3. Not failed but unfinished: nothing was created at Razorpay (no payment link, no payment, no refund), so no event has been received and no real event name, payload shape, `X-Razorpay-Event-Id` header, fee or tax field has been recorded.
>
> **How to resume, in order:**
> 1. Owner: fix `apps/api/.env` (both `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, new pair if regenerated; no quotes, no spaces around `=`, no trailing space; if `RAZORPAY_WEBHOOK_SECRET` changed, the dashboard webhook secret must be the same string). Then tell the new session.
> 2. Run `rz.mjs check` and expect `http_status 200`. If still 401, ask the owner to regenerate the test keys once, replace both lines, and re-run. Do not read the file.
> 3. Start the receiver in the background (`node --env-file=apps/api/.env .../receiver.mjs`), check `/health`; the owner runs `ngrok http 8788` and confirms the Forwarding line shows the dev domain; check `https://reusable-ploy-zap.ngrok-free.dev/health` is 200.
> 4. Ask the owner whether the dashboard's webhook event names match the nine above; adjust the subscription if not.
> 5. `rz.mjs create 10000 30 ...` (₹100, 30 minutes), give the owner the `short_url`; the owner pays it with UPI `success@razorpay` (and once with `failure@razorpay`, or a test card). Then: read `captured.jsonl` (event names, whether `X-Razorpay-Event-Id` is present, which events arrive and in what order, whether `payment_link.paid` and `payment.captured` both arrive), `fetch-link`, `fetch-pay` (fee, tax, method, `acquirer_data` keys), `refund` (full) then `fetch-refund` and the refund events, `cancel` on an unpaid link, an expiry test (the minimum window is 15 minutes, so expect a wait), a duplicate-`reference_id` create (expect an error), and a below-minimum amount (expect an error).
> 6. Write each recorded answer into spec section 7 (and Step 0), mark "docs unclear, fallback X" where applicable, stop the receiver, delete `captured.jsonl`, show `git diff --stat`, wait for "go" on 2b.
> 7. Then 2b (env scaffolding: `apps/api/.env.example`, `apps/web/.env.example`, `.gitignore` gets `.env.*` and `!.env.example`, `apps/api/src/billing/config.ts`, a small start-up call in `apps/api/src/index.ts`; checks with fake env objects only) and, after a second "go", 2c (migration 030, offline PGlite test, owner applies, live `TEST – ` checks, types-only additions to `packages/types`, then start the API and hit `/api/health`).
>
> **Standing rules for the spike:** never open, read, grep or print the env file; keys only via `--env-file`; all output through `out()`; the owner is on macOS; the owner never pastes the ngrok token or any key into chat; spec body sections are not yet rewritten (the banner wins where they differ); `CLAUDE.md` still says migrations are `001…028` (the owner's file; change only if asked).

> ## ROUND 2, decided 2026-11-12 (full text in the banner of `specs/payments-weekly-billing.md`; it supersedes section 10 too)
> - **Next step is still Step 2** (migration 030), preceded by **Step 0** (spike in test mode, **no Route**; keys only via `node --env-file=apps/api/.env`, never printed). The Step 2 plan was written in chat on 2026-11-12 and awaits the owner's approval; no code, migration or spike has run.
> - Route is not available (hidden until the account is verified): comedians pay the platform account and the owner pays venues outside the app. **Go-live gate: collecting without Route is unconfirmed** (Razorpay support and accountant). Route-specific columns, the linked-account table and transfer events are deferred.
> - Bill flow = the spec's (weekly drafts, per-bill owner send, 72 h auto-send fallback, no bulk send). Home card at the top of `/home`, `/dues/[billId]` then Razorpay. Dues rule: owner switch on = strict, off = lenient, new venues off, block only past `due_at`. Clear needs a modal plus `confirmed: true`, and is audited. Audit trail has fixed "important" columns only; 6-month retention for audit, webhook payloads and notifications; bills and payments are not auto-deleted pending the accountant.
> - Start-up check: only when billing is on (DB flag) and `NODE_ENV=production`; mode mismatch check always; 503 guard; enable-billing guard.
> - Tunnel: **ngrok**, free static dev domain (`<name>.ngrok-free.dev`); the owner is on macOS (the repo path and shell show Darwin, not Windows). The owner sets it up and tells me the domain; the auth token is never pasted anywhere.

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

## 10. Step 2 scoping (investigation only, 2026-11-08, second session "payment portal step - 2")

**Nothing was changed except this section.** No code, no migrations, no other file. Rules for this session: no Razorpay key, no Route, no webhooks exist, so everything built now must run with no external credential.

**Repo state now (supersedes the "uncommitted" notes in sections 0, 1 and 7):** branch `main`, HEAD `cd23e85 payment portal step 1 - cancellations`, tree clean (before this edit). Step 1 and its files, including `029` and `029b`, are committed. Latest migrations are `029` and `029b`; next is `030`. Confirmed by search: no `apps/api/src/billing/`, no Razorpay code or env vars, no `express-rate-limit`, no scheduler, `apps/api/src/services/` is empty. No API route hard-deletes shows, spots or requests (cascades fire only when a user or show row is deleted, i.e. test cleanup). `CLAUDE.md` still says migrations are `001`…`028` and does not mention 029/029b/030 (the user's file; change only if asked).

### 10.1 What Step 2 is, in plain terms

**Spec Step 2 = "Billing foundation, migration 030, no behaviour".** It creates the tables, enums, constraints, triggers, RLS and one seeded settings row that every later billing step stands on, with billing switched off. Files: `030_billing_foundation.sql` plus types-only additions in `packages/types` (no new runtime export). **No API and no UI.**

Tables (spec section 5): `billing_settings`, `venue_billing_settings`, `bills`, `bill_lines`, `billing_payments`, `billing_webhook_events`, `billing_events` (audit), `billing_exceptions`, `notifications`; plus the bill-number sequence, `bill_status_enum`, the immutability trigger (money columns frozen after `sent`), the append-only trigger on the audit table, the demo-row delete exemption, and the new retention settings from section 6.

**What each user can do when Step 2 is done: nothing new.** A comedian, a venue owner and the admin see no change; there is no screen and no route. What exists is a database that refuses wrong states (a second open payment attempt, an edited sent bill, a deleted audit row, any direct client write to a billing table).

**What it needs from Step 1:** `spot_requests` (FK `bill_lines.request_id`, RESTRICT); `price_paise_at_accept` is the amount a line will copy (NULL = "unpriced accepted spot", excluded); `price_source`, `accepted_at` and `cancel_cutoff_hours_at_accept` stay as evidence; `029b` guarantees every accepted request came through the owner's accept path, so every billable line is legitimate. Step 3 must re-point the ₹10,000 ceiling in `price_to_paise()` at `billing_settings.max_spot_price_paise`, so that column must exist in 030. RESTRICT FKs mean a user, venue or request with bills can no longer be deleted; test cleanup must delete demo bills first.

**Scope mismatch to settle (S2-1):** the user's brief says "Step 2, including the payment portal and its features". In the spec the portal is Steps 3 to 9 (lifecycle functions and API = 3, Razorpay core = 4, admin settings = 5, comedian dues = 6, owner dashboard = 7, dues gate = 8, admin oversight = 9, schedules = 10). Step 2 alone is database only.

### 10.2 Feasibility without Razorpay credentials

**Verdict:** yes for everything except the proof that real Razorpay behaves as assumed. The whole portal (tables, generation, lifecycle, manual clearing, dues gate, all three UIs, webhook route, payment application, reconcile, refunds, notifications, SQL schedules) can be designed, built and tested now **if** the payment gateway sits behind one interface with a fake implementation. The real adapter is the only piece that cannot be validated.

**A. Fully independent of Razorpay (build and test now)**
- Step 2: all of migration 030 (live checks with anon and user tokens and `TEST – ` fixtures).
- Step 3: generation (`billing_generate_week`), send, remove line, clear offline / waive, void, reissue, reopen, dispute, exceptions, venue settings, reminders, auto-send; the owner and admin routes; `express-rate-limit` (an npm package, no credential).
- Step 5: admin venue billing settings and global settings (the linked-account field takes any text now).
- Step 6: comedian dues list, bill detail, receipt, dispute; Step 7: owner billing dashboard; Step 9: admin oversight lists, totals, manual clear / reopen / void.
- Step 8: the dues gate (migration 033) is pure database and can be fully tested, including "paying unblocks immediately" using a manual clear or the fake.
- Step 10: the SQL part (generate, auto-send, reminders) is testable by calling the functions; enabling `pg_cron` is a Supabase dashboard step, not a credential.
- Notifications table and in-app notices.

**B. Touches the gateway: build behind a boundary, test with a fake**

Interface `PaymentGateway` (lives in `apps/api/src/billing/gateway/`), all methods in our own terms: amounts in paise, our ids, normalised results.
| Method | Fake implementation | At swap |
|---|---|---|
| `createPaymentSession({attemptId, amountPaise, expiresAt, callbackUrl, transfer?})` returns `{linkRef, redirectUrl, expiresAt}` | Stores nothing extra; `redirectUrl` points to a dev-only fake hosted page that reads the attempt from `billing_payments` | Real adapter calls Create Payment Link (or the Orders fallback; the interface returns a redirect URL either way) |
| `fetchSession(linkRef)` / `cancelSession(linkRef)` | Reads / updates the attempt row | Real fetch / cancel link |
| `fetchPayment(paymentRef)` | Returns the stored fake payment | Real fetch payment (source of the real fee and tax) |
| `createRefund(paymentRef, amountPaise, reason)` / `fetchRefund` | Marks refunded, emits `refund.processed` | Real refund with transfer reversal |
| `verifyAndParseWebhook(rawBody, headers)` returns normalised `GatewayEvent[]` or throws | HMAC-SHA256 with a local fake secret, same raw-body path | Real signature check and the **only** Razorpay-to-normalised mapping |

Everything else (webhook route, event store, idempotency, `billing_apply_payment_event`, reconcile, orphan flags, refund queue, all UI) sees only `GatewayEvent` fields: `eventId`, `type` (`payment.paid`, `payment.failed`, `session.expired`, `session.cancelled`, `refund.processed`, `refund.failed`, `transfer.failed`, ...), `sessionRef`, `paymentRef`, `amountPaise`, `currency`, `method?`, `feePaise?`, `taxPaise?`, `capturedAt?`, `raw`. Fee and tax are optional because Razorpay may only expose them by fetching the payment. The fake gateway can optionally duplicate, delay and reorder its own events, to exercise idempotency.

Payment tables should use provider-neutral names (`gateway`, `session_ref`, `payment_ref`, `provider_data jsonb`) instead of `razorpay_*` (S2-2). A **gateway contract test** (pure TypeScript, no credentials) that any implementation must pass is written once and re-run against the real adapter in test mode later.

**C. Only possible once the keys exist (deferred)**
- Step 0 in full: whether Payment Links accept a Route transfer, parameter and event names, `X-Razorpay-Event-Id`, fee and tax fields, refund reversal, Route test-mode limits, real fee rates (replaces the 270 bps placeholder).
- The real adapter (`razorpay.ts`) validated against the contract test; real signature verification; webhook registration (needs a public HTTPS URL or tunnel).
- Linked-account behaviour (KYC states, `payout_status` values), transfer settlement and failure events.
- Production items: API build and Render paid instance, Vercel Pro, the pg_net reconcile call needing a reachable API, live-mode guard with real key prefixes, first real payment and refund, Q1 (tax).
- I recommend **not writing the real adapter from docs now**: unverifiable code that looks finished is worse than a clearly empty slot.

**What will look finished in a demo but behave differently on real Razorpay**
1. Field names, event names and payload shapes: the adapter's mapping is a hypothesis until Step 0; a real event may lack a field the normalised event assumes (fee and tax are the likeliest).
2. Timing and ordering: the fake delivers once, in order, instantly; Razorpay delays, retries for about 24 h, duplicates, sends `payment_link.paid` and `payment.captured` both, and can reorder.
3. The money split: the fake cannot prove a Route transfer to a linked account works, nor settlement timing, transfer failures, reversal on refund or negative balances. "Venue received ₹486.50" is our own arithmetic.
4. Fees: the fake invents the fee; the 270 bps estimate and the estimate-versus-actual variance view are untested against real numbers.
5. Payment reality: UPI pending then captured later, authorized versus captured, 3-D Secure, bank declines, mobile redirects, partial payment rules (`accept_partial`).
6. Request limits: `reference_id` rules, notes limits, minimum `expire_by` window, minimum amount, API errors and timeouts, no idempotency key on create (a timeout after server success can leave an orphan link). Our row-first design is meant to handle this but is untested.
7. Webhook transport: the fake calls our own handler in-process, so raw-body handling behind Render's proxy, TLS, retries to a sleeping server and the real signature header format are untested.
8. Redirect: Razorpay appends parameters to `callback_url`; the fake mimics it. We ignore them either way.
9. Refund timing: real refunds can take days; the fake is instant.
10. Test mode versus live mode on Razorpay differ too; Step 11 stays the first real-money proof.

**Danger of the fake:** it is a "simulate payment" path, which spec row 27 deliberately excluded because it could ship to production. If kept, it must be unable to run there (S2-6).

### 10.3 Open questions for Step 2 (recommended answers)

"Blocks start" = needed before the Step 2 plan can be written.

| # | Question | Recommended answer and reason | Blocks start |
|---|---|---|---|
| S2-1 | **Scope.** Is Step 2 only migration 030 (tables, no API, no UI), as the spec says, or do you want the portal built in this step? Also confirm the 030 table list in 10.1 | Keep Step 2 = 030 only. Table design is the hardest thing to change, so it gets its own review. Then: 031 + API (Step 3), a new **Step 4a** (gateway interface, fake, webhook route, payment functions, no credentials), the dues gate, the UIs. Real adapter = **Step 4b**, after keys | **Yes** |
| S2-2 | Payment tables: keep the spec's `razorpay_*` columns, or use provider-neutral names plus a `gateway` column and `provider_data jsonb`? | Neutral, and keep both tables in 030. Swapping gateways then touches no schema, and later column additions stay additive. Spec rows and section 5 get updated | **Yes** |
| S2-3 | **Audit trail** (last session's open item, section 6). Accept: `billing_events` in 030, strictly append-only; retention as settings (`webhook_payload_retention_days` 90, `notification_retention_days` 90, `audit_archive_after_months` 24, NULL = never); no archive job now; do not record refusals (late cancel, ended-show accept) because they change no state | Yes to all four. The archive step needs somewhere to export to, which does not exist, and the append-only trigger should stay absolute until then. Settings columns cost nothing now and make retention a value, not code. Spec section 5 gets the audit text once you agree | **Yes** (adds columns to `billing_settings`) |
| S2-4 | **Manual clearing** (owner and admin mark dues paid, spec section 9). Confirm: owner clears only a `sent` bill of their own venue without admin approval; reason of 5 or more characters; reference optional; no partial offline payment (void and reissue for the rest); the comedian and, for an admin clear, the owner are notified; undo = admin reopen only; a clear with an open payment link cancels the link first and refuses if already paid | Confirm as written, adding "notify the owner on an admin clear". The behaviour is Step 3, but the status, `cleared_*` and CHECK columns are fixed in 030 | No, unless you want a change to the columns |
| S2-5 | **Pending-dues booking rule** (spec section 8, built in Step 8, migration 033). Confirm: blocked = strict policy + `sent` bill past `due_at` + not in a dispute pause + no exception, per venue only; admin override beats owner beats global default; default lenient; **lenient = never blocks, only warns**; already-accepted future spots untouched | Confirm as written. 030 holds the columns (`dues_policy_default`, `dues_policy`, `dues_policy_admin_override`, `billing_exceptions`) | No |
| S2-6 | **Fake gateway.** Allow it despite spec row 27? | Yes, with four guards: it runs only when `BILLING_GATEWAY=fake`; the API refuses to boot with it if `NODE_ENV=production` or `RAZORPAY_MODE=live`; fake payments carry `gateway='fake'` and the database refuses to apply them to a bill that is not `is_demo` (venue name `TEST – `); the fake hosted page route is not mounted otherwise. Row 27 is rewritten accordingly | No (blocks Step 4a) |
| S2-7 | Where do tests live? `CLAUDE.md` says no tests are configured, and Step 1 kept live check scripts in the scratchpad | Keep live database scripts in the scratchpad (they need the real project and credentials). Commit only the credential-free gateway contract test, run with Node's built-in test runner through `tsx` (no new dependency) | No (blocks Step 4a) |
| S2-8 | Work order. The spec puts the Razorpay core before any UI so the risky part is proven first. That proof is impossible without keys | Keep the spec order but build the UI against the fake. The risk moves to Step 4b, contained by the rule that the UI and the apply functions only ever see our own normalised shapes. Accept that Step 4b may force a change to the event model and a small additive migration | No |
| S2-9 | Do you have a Razorpay test-mode dashboard (test keys)? | Check. As far as I know (unverified) test-mode keys are issued at sign-up without KYC; Route in test mode may need its own activation. If they exist, Step 0 can run in parallel and Step 4b may not have to wait for KYC | No |
| S2-10 | Tax (Q1) and bill numbers | No tax columns in 030 (adding later is additive). Note that `B-000123` comes from a sequence, which can skip numbers; if GST invoices are required, they need a separate gap-free invoice number, so a bill number is not an invoice number | No |
| S2-11 | N18: your Supabase plan, current database size, venue counts, and whether `pg_cron` / `pg_net` can be enabled | Run `select pg_size_pretty(pg_database_size(current_database()));` in the SQL editor and check Database > Extensions. Real money should not sit on the Free plan | No (needed before Step 10) |
| S2-12 | N19: retention periods with your accountant | Keep the defaults in S2-3 as settings; change the value, not the code, when the accountant answers | No |

### 10.4 Housekeeping noted this session
- This section is the only edit; the user commits. Sections 0, 1 and 7 still say "uncommitted" and describe `aaa600c` as HEAD; section 10.1 supersedes them.
- Nothing was run against the live database this session; no fixtures were created.
- Waiting for answers to S2-1 to S2-3 (blocking); no plan and no implementation until the user replies "go".

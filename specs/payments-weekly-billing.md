# Payments: weekly billing (Razorpay Route)

> ## PROGRESS AND PLANNING STATUS (as of 2026-11-13, end of the session that finished Step 2). Read this first.
>
> | Step | What | Status |
> |---|---|---|
> | 0 | Razorpay test-mode spike (no Route) | **Done**, except refunds: retry on or after 2026-11-17 (see "Step 0 record") |
> | 1 | Price lock, cancel cutoff, accept-after-show refusal (029, 029b) | **Done**, applied, verified, **committed** (`cd23e85`) |
> | 2 | Billing foundation: 2b env scaffolding and start-up check; 2c migration 030 (9 tables, guards, RLS, billing OFF) | **Done**, 030 applied by the owner and verified live (160 checks) and offline (255). **UNCOMMITTED** |
> | 3 | Generation and lifecycle functions (migration 031) plus thin API with rate limits | **NEXT. Not started and not yet planned in chat; needs a plan, then the owner's "go"** |
> | 4 to 11 | Razorpay core and webhook; admin settings; comedian dues; owner dashboard; dues gate; admin oversight; schedules; go-live | Not started; only the outline in section 13 exists |
>
> **How far the planning has gone.** Detailed, agreed plans exist for Steps 0, 1 and 2 only (and are built). Steps 3 to 11 have only the outline in section 13 plus the round 1 and round 2 decisions in the banners; each gets its own plan in chat and its own "go" when reached. The spec body (sections 5 to 12) still carries Route-era wording; the banners win where they differ, and section 13 is rewritten step by step as each is planned.
>
> **UNCOMMITTED WORK (the owner is about to commit it).** Everything from Step 2 is in the working tree, not in git: `.gitignore`, `CLAUDE.md`, `apps/api/src/index.ts`, `apps/web/.gitignore`, `packages/types/index.ts`, `specs/decisions.md`, `specs/handoff.md`, this spec, plus the new files `apps/api/.env.example`, `apps/web/.env.example`, `apps/api/src/billing/config.ts`, `apps/api/src/billing/startup.ts` and `apps/api/src/db/migrations/030_billing_foundation.sql`. Migration 030 is already applied to the live Supabase project, so the repo is currently behind the database until this is committed. The owner is expected to commit it after this note; if `git status` is clean when you read this, assume that happened, and confirm with `git log` before relying on it.
>
> **Still open, not blocking Step 3:** refund test (due 2026-11-17); Route and collecting without Route (go-live gate); Q1 tax/GST; N18 Supabase plan; N19 retention for bills. **Step 3 also owes:** re-point `price_to_paise()` at `billing_settings.max_spot_price_paise`.

> ## PLAN CHANGE, decided 2026-11-12 (read first; supersedes earlier wording)
> - **Razorpay onboarding and KYC have NOT been started.** They are deferred until after the site is deployed: Razorpay needs a live deployed website to verify, and the KYC and business details are permanent once submitted, so the owner will not submit them until the product is finished.
> - The owner already has Razorpay **TEST** API keys (`rzp_test_...`), generated without KYC. **Everything from Step 2 to the last step is to be built and verified against Razorpay TEST mode.**
> - **Order of work:** (1) build and test the full payments system with test keys; (2) deploy the site; (3) only then complete Razorpay onboarding and KYC and switch to live keys.
> - **Going from test to live must be a configuration change only** (keys, webhook secret, webhook URL, through environment variables), with zero code changes.
> - **Superseded:** any wording elsewhere in this spec, in `specs/handoff.md` (including section 10, the "fake gateway" proposal and the 4a/4b split) or in earlier chat summaries that says or implies "no Razorpay key", "stubbed", "deferred because KYC is in process", or "waiting for keys" is **no longer current**. Where those passages conflict with this note, this note wins. Sections will be rewritten when each step's plan is agreed; until then, read them with this note in mind.
> - Keys are never printed, written to a file git can see, or sent to the web app. `.gitignore` and `.env.example` are handled as the first implementation step.
> - Still true: **Route eligibility, Route behaviour in test mode, real fees and live-only behaviour are unconfirmed** and are only settled at onboarding (see the 2026-11-12 findings in `specs/handoff.md`).
> - **Step 2 done 2026-11-13: migration 030 applied by the owner and verified live** (see the "Migration 030 record" in section 13). Billing is still OFF; no billing API route or screen exists yet. **Next is Step 3** (generation and lifecycle functions, migration 031).
> - **Step 0 spike done 2026-11-13** except refunds: see "Step 0 record" in section 13. **Refund test is pending: retry on or after 2026-11-17** (payment not settled, balance zero; both the API and the dashboard returned `invalid request sent`).

> ## DECISIONS, round 2 (2026-11-12, answers to the Step 2 questions; these supersede the sections below where they differ)
>
> **Purpose and Route.**
> - Testing with the test keys has ONE purpose: a working payment portal that approves transactions end to end. **Route is not used or tested now** (the Route tab is hidden in the dashboard until the account is verified). Route stays the planned option for later; when it is added it is tested then, including the transfer path.
> - **Money flow for now:** the comedian pays the **platform's** Razorpay account; the owner (platform operator) pays each venue onward **outside the app** (bank or UPI). `venue_net_paise` (amount minus commission minus fee share) is still frozen on each bill because it says what each venue is owed. No payouts ledger now (the owner dashboard says "collected online, paid out by the platform"; admin sees the same totals). Refunds come from the platform balance with no transfer reversal (Q20 is moot for now).
> - **GO-LIVE GATE (unconfirmed):** whether the platform may collect money on behalf of venues **without Route** on a normal Razorpay merchant account is **not verified**. It must be settled with Razorpay support and the owner's accountant before any live key is used. Added to section 7.8 and Step 11.
> - **Deferred to the Route step (nothing of it is built in 030):** `razorpay_linked_account_id`, `payout_status`, the per-mode linked-account table (B2), `transfer_id`, `transfer_status`, the `transfers` field of the Payment Link request, and handling of `transfer.*` events. All are additive. Design rule now: the Razorpay request body is built in **one function** in `razorpay.ts`, which omits `transfers`; Route adds it.
> - **Pay-button eligibility** (replaces "payout account is active", rows 9 and section 10): an admin per-venue switch `venue_billing_settings.online_payments_enabled`, default false. A venue without it sends offline-only bills. Until Step 5 exists, billing and this switch are set for test venues with the service role or the SQL editor.
> - "Test to live is a configuration change only" now holds for **keys, webhook secret, webhook URL and mode**. Adding Route later is a small code change, not config.
>
> **Bill flow (the spec's flow stands; nothing extra is built).** The weekly job creates drafts; the owner reviews each bill (may remove a no-show line) and sends it one by one; the 72-hour auto-send stays as the fallback (owner can opt out; runs from Step 10). **No bulk "send all" button** (considered and dropped; easy to add later). Comedian side: `/home` shows, at the very top, one card per unpaid **sent** bill (comedian role only, stacked, collapsing after 3, overdue styling, no Sidebar or Navbar change). The card opens `/dues/[billId]` first (every charge shows its show, venue, date and spot type), then Pay goes to Razorpay. Only the webhook marks a bill `paid` (a delay of seconds, covered by a "Confirming" screen and a refresh button); "cleared" in this spec means a manual clear (offline or waived), and `paid`, `paid_offline` and `waived` all unblock. Order of steps stays 4, 5, 6, 7; "send" is driven by curl or the SQL editor until Step 7.
>
> **Dues rule (supersedes the wording of section 8 where it differs).** The venue owner switches it on or off: **on = `strict`, off = `lenient` (warns only)**; the admin override and the global default stay; **new venues start off**. Blocked = switch on, a `sent` bill at that venue **past `due_at`**, not under a dispute pause, no exception; **any** such bill at that venue (never another venue). Drafts and `void` never count; `paid`, `paid_offline`, `waived` and `refunded` do not block. Accepted future spots and pending requests are untouched; accepting a blocked comedian is refused. The **dispute pause and the owner exception are kept**: their tables and columns are in 030, their workflows (Step 3) and screens (Step 7) come later in the spec order.
>
> **Manual clearing.** The owner (and the admin, same modal) must see a **warning modal and confirm** before a clear is accepted, and the API **refuses a clear unless the request carries `confirmed: true`**. Every clear is recorded in the audit trail: who, which bill, when, the reason (and the reference and kind, offline or waived). The modal itself is built in Step 7 (owner) and Step 9 (admin), not in Step 2.
>
> **Audit trail (`billing_events`) holds only the important facts, in fixed columns (no free-form `metadata`).** Events recorded: payment captured, payment refunded, payment flagged (orphan, duplicate, wrong amount), bill cleared offline, bill waived, bill reopened, a sent bill voided. Columns: `id`, `created_at`, `action`; `bill_id`, `bill_number`, `from_status`, `to_status`, `amount_paise`, `week_start`; `comedian_id`, `comedian_name`; `venue_id`, `venue_name`, `venue_owner_id`; `actor_id`, `actor_role`, `actor_name`; `reason`, `reference`; `payment_id`, `razorpay_payment_id`, `method`, `mode`, `fee_paise`. Not recorded: webhook payloads, emails, phones, IPs, draft generation, line removal, sends, reminders, notifications, settings changes (those rows keep `updated_by` and `updated_at`), disputes (their fields live on the bill).
>
> **Retention.** Audit trail, webhook payloads and notifications: **6 months**, kept as settings (`audit_archive_after_months`, `webhook_payload_retention_days` as 180, `notification_retention_days` as 180); this replaces the 90-day and 24-month defaults (Q16 included). No prune job before Step 10. **Bills, bill lines and payments are a separate record with no retention setting and are never auto-deleted** until the owner's accountant answers (Q1, N19); the 6 months is not a legal answer for them. Clears stay provable after pruning because the bill row keeps `cleared_by`, `cleared_at`, `clear_reason` and `clear_reference`.
>
> **Start-up check.** Billing is "on" when `billing_settings.billing_enabled = true`, read once at start-up (a missing table means off). "Deployed" is `NODE_ENV=production`. When both hold, the API **exits** with a message naming each problem unless `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` exist (id starting `rzp_test_` or `rzp_live_`), `RAZORPAY_WEBHOOK_SECRET` exists and `RAZORPAY_MODE` is `test` or `live`. `BILLING_CRON_SECRET` is required only from Step 10. The prefix versus `RAZORPAY_MODE` mismatch check runs **every time the Razorpay client is built**, deployed or not. If config is incomplete, billing routes return 503 with a clear message, and the admin "enable billing" action refuses. Messages name the variable, never the value; nothing is logged. Local development and unrelated work are never blocked.
>
> **Test-money rule (B1).** A test-mode payment may mark a real bill paid while the site runs on test keys; every payment and bill records `mode`. Before the live switch, bills with test payments are voided or deleted (a go-live checklist item).
>
> **Step 2 order and spike.** **Step 0 runs first** in test mode, **without Route**: Payment Link with no transfer, a test payment paid in the owner's browser, refund, event names and the event-id header, fee and tax fields. Scripts live in the session scratchpad and load keys only through `node --env-file=apps/api/.env`; output is an allow-list of fields, never headers or the key values. Webhook capture uses a throwaway receiver (not the API) behind an **ngrok** tunnel on the free static dev domain. Then migration 030 and the env scaffolding (`.env.example` for both apps, `.gitignore` hardening, `apps/api/src/billing/config.ts`).

**Scope:** System 2 (`venue_shows` / `spots` / `spot_requests`) only. A venue owner bills every comedian who has an **accepted** spot at the venue once per week; the comedian pays online through Razorpay; the money is split automatically to the venue's Razorpay linked account (Route). Owners and admins can clear or waive bills. An owner (or the admin) can block comedians with overdue bills from booking more shows at that venue. Admin gets oversight, stuck-payment tools and the global settings.

> **Status: design, plus Step 1 diff 1a: migration 029 was written, applied by the user and verified live on 2026-11-08, Step 1 diff 1b (API and types) was built and verified live the same day, and migration 029b (closing the direct-insert hole) was applied by the user and verified live the same day, and Step 1 diff 1c (web) was built and statically checked the same day; the user checked it in a browser and reported that everything works (see the Step 1 record). Step 1 is complete. Nothing else is implemented, no billing table exists, and no Razorpay call has been made.** This spec was written from a read-only investigation of the codebase and from Razorpay's public docs. Razorpay behaviour that the docs left unclear is listed in Step 0 (the spike) and must be confirmed in test mode before Step 4 starts. See "What was and was not verified" at the end.

Delivered in small steps (Step 0 to Step 11). Each step is independently shippable and reviewable. Per `CLAUDE.md`: plan in chat, wait for "go", update this spec in the same change as the code, show `git diff --stat`, say plainly what was and was not verified, and the user commits.

Tags used throughout: **[CORE]** the system does not work without it; **[ESSENTIAL]** needed before real money flows; **[LATER]** useful, deferrable (collected in "Deferred").

---

## 1. Changes and additions beyond the brief (review this first)

| # | Change | Kind | Tag | Why (one line) |
|---|---|---|---|---|
| 1 | Billing is **opt-in per venue** plus a global switch and a `billing_start_date`; nothing is billed retroactively | Added | CORE | Lets one trusted venue pilot real money; stops surprise bills for shows booked before launch |
| 2 | Price is **locked when the request is accepted** and the bill uses that price. The price at request time is also stored, as evidence only | Decided 2026-11-08 (the first draft billed the lower of the request-time and accept-time prices) | CORE | An owner edit after acceptance can never change a bill; the request-time price records what the comedian saw |
| 3 | A comedian **cannot cancel an accepted spot** after the venue's cutoff (a **venue setting**, whole hours 0 to 12, default and maximum 12, copied onto the request at accept) and never after the show starts | Added; venue-configurable by decision 2026-11-08 | CORE | Today `comedian_cancel_spot_request` works at any time, so a comedian could cancel after the show and dodge the bill |
| 4 | **Accepting a request after the show has ended is refused** (DB trigger) | Added | ESSENTIAL | Otherwise an owner can retro-accept someone and bill them for a show they were never booked on |
| 5 | **Payment Links** (Razorpay-hosted page) with the Route transfer attached, created lazily when the comedian presses Pay, one open link per bill | Chosen (brief asked me to choose) | CORE | Matches "redirect to a Razorpay portal"; docs say Payment Links support Route transfers; sending a bill creates no Razorpay object |
| 6 | Gateway fee is charged to the venue as a **fixed estimate in basis points** (default 270) stored per bill; the **actual** fee is recorded per payment | Added | CORE | Keeps the transfer a single atomic step; platform never guesses at settle time; variance is visible to admin |
| 7 | Commission is a number (default 0 bps) with a global default and a per-venue override, **copied onto each bill when sent** | Added | CORE | You said it will rise later; raising it must never change a bill already sent |
| 8 | Linked accounts are **onboarded by the admin in the Razorpay dashboard** in Phase 1; the app stores only the account id. Self-serve onboarding is [LATER] | Pushed back (simplified) | CORE | Avoids this app ever handling PAN and bank details; a solo admin can onboard a handful of venues by hand |
| 9 | A venue with **no active payout account** can still send bills, but they are **offline-only** (no Pay button; owner clears manually) | Added | CORE | Otherwise venues stuck in KYC cannot use billing at all |
| 10 | **Overdue is derived**, not a stored status (`sent` and past `due_at`) | Changed | CORE | No job can forget to flip it; blocking, reminders and the UI use one predicate |
| 11 | **Disputed** is a flag on a sent bill with a **7-day pause** of reminders and blocking, one dispute per bill | Added | ESSENTIAL | Gives honest comedians a path other than being blocked, and the 7-day limit stops it becoming a way to dodge dues |
| 12 | **Auto-send** after a 72 h review window is **[ESSENTIAL]**, not [LATER], with safeguards (cap, flagged lines, owner opt-out) | Pushed back | ESSENTIAL | Dues only block once a bill is sent; if owners forget, the whole system silently does nothing |
| 13 | Owners can **remove** a line (reason required) but cannot add lines or change amounts | Added | CORE | Closes owner-side inflation; lines come only from accepted requests |
| 14 | A **voided draft stays void**; the weekly job never regenerates it. Reissue is an explicit action | Added | CORE | Otherwise a discarded draft would reappear every week |
| 15 | **Reissue** = void the sent bill and create a fresh **draft** (supersedes link), owner edits and sends | Added | CORE | One mechanism for all post-send corrections; sent bills are never edited in place |
| 16 | **Orphan / duplicate payment** handling: a captured payment that cannot be applied to a bill is stored, flagged, and shown in an admin refund queue | Added | ESSENTIAL | Races between payment, void and clear are possible; money must never silently vanish |
| 17 | **Reconciliation:** comedian "I've paid, refresh" button, admin per-attempt re-sync, and a daily reconcile job | Added | ESSENTIAL | Webhooks can be missed or misconfigured |
| 18 | **Webhook event store** (insert first, then process) with replay from admin | Added | CORE | Idempotency, forensics, and recovery from a processing bug |
| 19 | Scheduling by **`pg_cron`** (SQL jobs) plus `pg_net` for the one job that must call the API | Added | CORE | The API has no scheduler and Render's free tier sleeps |
| 20 | **Rate limiting** via the new `express-rate-limit` dependency; the repo has none today | Added | ESSENTIAL | Brief asked for it; there is nothing to extend |
| 21 | Dues gate is **DB triggers** (like the 020 venue gate) **plus** structured results from `apply_to_spot` and `accept_spot_request` | Added | CORE | `spot_requests_insert_own` RLS allows direct inserts, so an API-only check is bypassable |
| 22 | Switching a venue to **strict** shows how many comedians would be blocked immediately and asks for confirmation | Added | ESSENTIAL | A one-click policy change should not silently block people |
| 23 | **Undo** of a manual clear is **admin-only reopen**; owner self-undo is [LATER] | Decided (brief left open) | ESSENTIAL | Keeps accounting simple; admin can fix an owner's mis-click |
| 24 | New **`notifications`** table for in-app notices to comedians and owners | Added | CORE | Only owners have a notices table today; comedians have none |
| 25 | **Email stays deferred, but I flag it as the biggest launch risk:** with in-app notices only, a comedian who never opens the app can be blocked "by surprise" | Flagged | ESSENTIAL (before wide launch) | Cheap mitigations in this spec: lenient default policy, "copy bill link" for owners, banner at booking time |
| 26 | Human **bill numbers** (`B-000123`) | Added | ESSENTIAL | Support and disputes need something to quote |
| 27 | **Demo flag** on bills and a "TEST – " guard; demo uses **Razorpay test mode** end to end, no fake "simulate payment" endpoint | Added | ESSENTIAL | Test mode already behaves like real payments; a simulate endpoint is dead code that could ship to production |
| 28 | **`RESTRICT` foreign keys** and bill rows that snapshot names; users and venues with bills cannot be deleted | Added | CORE | `spots` cascade-deletes with the owner today; billing records must survive |
| 29 | **Mode guard:** the API refuses to start if the key prefix (`rzp_test_` / `rzp_live_`) disagrees with `RAZORPAY_MODE`; every payment row records its mode | Added | CORE | Prevents test and live money mixing |
| 30 | Safety **caps**: per-spot price ceiling, per-bill cap for auto-send, minimum online amount | Added | ESSENTIAL | Limits damage from a typo (₹1500 entered as ₹150000) |
| 31 | Billing config lives in its **own table**, not as columns on `venues` | Added | CORE | Owners can update `venues` through PostgREST; an admin-only lock must not be writable by them |
| 32 | New billing code goes in **`apps/api/src/billing/`**, registered from `index.ts` | Changed (CLAUDE.md says routes are inline) | CORE | `index.ts` is already 1,893 lines; the webhook also needs a mount before `express.json()` |
| 33 | **Dropped or downgraded:** combined "pay all" view [LATER]; partial payments forbidden; partial waivers out (use remove-line or reissue); owner-added lines out; chargeback workflow [LATER] (events are recorded and the bill is flagged); transfer holds [LATER]; grace period / amount threshold [LATER]; self-serve linked-account onboarding [LATER]; GST invoices = open question | Removed / downgraded | LATER | Over-engineered for the stage, or not decidable by me |

---

## 2. Findings from the investigation (short)

**Schema and lifecycle (System 2).**
- `venue_shows` (date, start/end time, `is_cancelled`) has up to three `spots` pools per show: `busking`, `non_busking`, `hosting` (hosting is a single-spot pool with its own price). `spots.price` is a **nullable rupee `numeric`**; `NULL` or 0 means free. `spots.venue_producer_id` is the owner's `users.id`; `venues.owner_id` links back (one venue per owner is assumed repo-wide).
- `spot_requests`: statuses `pending`, `accepted`, `waitlisted`, `cancelled_by_comedian`, `cancelled_by_venue`. Waitlist promotion is the same `accept_spot_request` RPC (017a). A swap sends the earlier accepted request back to `pending`. `accepted_at` and `cancelled_from_status` exist (019); `decided_at` is overwritten on every transition. `show_id` is denormalised onto requests (017a).
- **`spot_requests` stores no price.** `update_show` can change a pool's price after people are accepted, and only accepted and waitlisted requests get an `edit_notice`, not pending ones.
- `comedian_cancel_spot_request` (016) has **no cutoff** and works for an accepted request at any time, including after the show.
- `accept_spot_request` has **no check on the show date**; `apply_to_spot` rejects past dates, but with `CURRENT_DATE` (server timezone, not IST).
- `admin_suspend_venue` (021/027) cancels only **upcoming** shows (`venue_show_is_upcoming`), so a suspended venue's past accepted requests stay accepted.
- Hosting has a price column like the other pools. **Decided 2026-11-08: the host (the comedian) pays it, and it is billed like any other spot.**

**Guards and patterns.** `requireUser` + `requireRole(...)`; `/api/admin/*` is default-deny. New SQL functions follow the `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role` rule. The 020 venue gate uses **triggers**, exempt when no JWT claims are present (SQL editor), because `spot_requests_insert_own` lets a comedian insert directly through PostgREST (the open follow-up in `specs/spot-requests-rls-insert-followup.md`, which also allows self-inserting an `accepted` row).

**Notices and reminders.** "Notices from Admin" is `venue_notices` (owner only, written by the hide and suspend RPCs). Comedians have only the per-request `edit_notice` and the Reminders cards. There is **no general notification table**.

**Infrastructure.** `express.json()` is mounted globally (`index.ts` line 125) before every route, so a Razorpay webhook needs a raw-body route mounted before it. No rate limiter, no scheduler, no Razorpay package, no Razorpay env vars. The CORS function allows requests with no `Origin` header, so webhooks pass CORS. `apps/api` has no production build (only dev under `tsx` works): **a production deployment is a prerequisite for real money** (see Step 11).

**Payment leftovers.** Only the legacy System 1 `bookings.payment_status`, `payment_id`, `payment_provider` columns and the unused `PaymentStatus` type. Unrelated; left alone.

**Migrations.** Last is `028`; this spec uses `029` to `034`.

---

## 3. Decisions already made (yours)

| ID | Decision |
|---|---|
| D1 | Payment gateway is Razorpay. |
| D2 | Money flow is **Route with linked accounts** (option b): comedian pays into the platform's Razorpay account; Razorpay transfers the venue's share to its linked account. The platform never hand-settles. |
| D3 | **Commission is 0% for now** and will probably rise. It is stored as basis points, with a global default and a per-venue override. |
| D4 | The **venue bears the gateway fee**; the comedian pays exactly the bill amount (no surcharge). |
| D5 | Venue owners bill comedians weekly for accepted spots; owners and admin can clear a bill manually; dues-blocking policy is chosen by the owner and can be overridden by admin. |
| D6 | Email (Resend) stays deferred. System 1 is out of scope. |
| D7 | Hosting spots are billed like any other spot and the comedian pays them. Free spots are billed too, as ₹0 lines. A week whose lines are all ₹0 creates no bill; ₹0 lines appear only on a bill whose total is above ₹0. (2026-11-08) |
| D8 | The billed price is the price **locked when the request is accepted** (`price_paise_at_accept`). The price at request time is stored as evidence only. (2026-11-08) |
| D9 | The cancellation cutoff is a **venue setting** chosen by the owner: whole hours 0 to 12, default and maximum 12, copied onto each request at accept so later changes never affect it. Cancelling an accepted spot is never allowed after the show's start time. Admin sees it read-only for now. The comedian is shown the cutoff before requesting. (2026-11-08) |
| D10 | Every bill line shows the show, venue, date and spot type (including hosting). Retention periods for billing records are settings, not code, and are confirmed with the user's accountant (Q1). (2026-11-08) |

Every other default is in section 17 (open questions) so you can approve or change it.

---

## 4. Definitions

### 4.1 Billing week
- Monday 00:00 to Sunday 23:59:59 **IST**, keyed by `week_start` (the Monday `date`). A show belongs to the week of its `venue_shows.date`. Shows cannot cross midnight (`end_time > start_time` is a CHECK), so there is no ambiguous case.
- All new billing logic uses `Asia/Kolkata` explicitly (`now() AT TIME ZONE 'Asia/Kolkata'`). The existing `CURRENT_DATE` checks are **not** changed.
- A week is **complete** when the IST date is after its Sunday. Drafts are generated for complete weeks only.

### 4.2 Which requests are billable
A `spot_requests` row becomes a bill line when **all** hold at generation time:
1. `status = 'accepted'`;
2. its spot and show are not cancelled;
3. the show date is in the week and **on or after `billing_start_date`**;
4. the venue has billing enabled;
5. the billed amount (4.3) is known (not NULL). **Free spots (amount 0) do produce a line, at ₹0**;
6. it is not already on an active line of another bill.

Never billable: `pending`, `waitlisted`, `cancelled_by_comedian`, `cancelled_by_venue`. Hosting is billed **like any pool and the comedian (the host) pays it** (decided 2026-11-08, Q2 closed). A bill whose total is ₹0 is never created (section 6): ₹0 lines appear only on a bill whose total is above ₹0.

### 4.3 Price snapshot and money
- `spot_requests` gets `price_paise_at_request` (evidence only, set by a trigger on INSERT), `price_paise_at_accept` (the **billed** price: set by a trigger whenever the status changes to `accepted`, cleared when it leaves `accepted`), `cancel_cutoff_hours_at_accept` (the venue's cutoff, copied at accept) and `price_source`. Neither a direct insert nor an update can forge them. **Built in migration 029.**
- **Billed amount = `price_paise_at_accept`**, the price when the request was accepted (a waitlisted request is priced when it is promoted; a swapped-out request loses its lock and is priced again if accepted again). `price_paise_at_request` is kept only as evidence of what the comedian saw when applying. After acceptance, nothing the owner edits changes the amount. Consequence accepted 2026-11-08: an owner who raises a price while a request is pending bills the higher price, so the accepted request card shows the locked price.
- Rupees to paise: `ROUND(price * 100)` (half away from zero). A free spot (price NULL or 0) snapshots **0** and becomes a ₹0 line. A price below 0, above the ceiling (₹10,000 per spot, a constant in `price_to_paise()` until Step 3 re-points it at `billing_settings`) or with more than 2 decimals is **not silently snapped**: the snapshot is stored as NULL, the request is excluded from billing, and the owner and admin see "unpriced accepted spot".
- Requests accepted before migration 029 are back-filled from the spot's current price and the venue's current cutoff, and marked `price_source = 'backfill'`. The marker is data only: back-filled rows are billed like any other (no review marker, decided 2026-11-08). Their `price_paise_at_request` stays NULL (the real value is unrecoverable and a guess would be worse than none).
- **All money is integer paise** everywhere (columns, API, UI conversion at the edge). Currency is always INR. Razorpay amounts are the same integers.
- Commission = `ROUND(amount * commission_bps / 10000)` (half up). Fee share = `CEIL(amount * fee_share_bps / 10000)` (up, so the platform never under-collects). Venue net = amount − commission − fee share, with `CHECK (venue_net >= 0)`.

### 4.4 One bill per comedian, venue and week
Unique `(venue_id, comedian_id, week_start)` among non-void bills. A comedian who booked at two venues gets two bills, each payable alone.

### 4.5 No-shows
No attendance data exists and I am not adding it. **No-shows are billed by default** (the spot was held and a cancellation cutoff existed). The owner removes the line during draft review with reason "no-show waived" if they choose. A comedian who disagrees uses the dispute action.

---

## 5. Data model (migrations 029 to 034)

All new tables: RLS on; `REVOKE INSERT, UPDATE, DELETE` from `anon` and `authenticated`; read policies as noted; **all writes through `SECURITY DEFINER` functions called with `supabaseAdmin`**, each function ending with `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role`. Foreign keys to `users`, `venues`, `spot_requests` are `ON DELETE RESTRICT`.

### Migration 029: price lock, venue cancel cutoff, ended-show refusal (touches existing tables; ships first)
**Written 2026-11-08 as `apps/api/src/db/migrations/029_request_price_snapshot_and_cancel_cutoff.sql`; one transaction, safe to re-run. Applied by the user on 2026-11-08 and verified live (see the Step 1 record).**
- `venues` adds `cancel_cutoff_hours smallint NOT NULL DEFAULT 12 CHECK (0 to 12)`: the whole hours before the show starts up to which a comedian may still cancel an **accepted** spot. The owner chooses it; 12 is also the maximum. It lives on `venues` because it is a booking rule (it applies with billing off) that comedians must be able to read before requesting. The CHECK is the real guard: `venues_owner_update_own` lets an owner write any `venues` column straight through PostgREST.
- `spot_requests` adds `price_paise_at_request` (evidence only), `price_paise_at_accept` (the billed price; 0 = free, NULL = invalid), `cancel_cutoff_hours_at_accept` and `price_source` (`trigger` | `backfill`, how the accept lock was set; NULL while there is no lock).
- `price_to_paise(numeric)`: NULL or 0 gives 0; negative, above ₹10,000, or more than 2 decimals gives NULL; otherwise `ROUND(price * 100)`. **The ceiling lives only here.** Step 3 re-points it at `billing_settings.max_spot_price_paise`.
- Trigger `trg_spot_requests_lock_terms` (BEFORE INSERT OR UPDATE, SECURITY DEFINER, fixed `search_path`; looks the spot up through `spot_id`, not `show_id`, because same-event triggers fire alphabetically and this one runs before `trg_spot_requests_set_show_id`):
  - INSERT: sets `price_paise_at_request`; any client-supplied value in the four columns is overwritten; a row inserted already `accepted` (the open RLS hole) is locked like an accept and refused if the show has ended.
  - Status change to `accepted`: refuses if the show has ended (IST, `date + end_time`), then sets `price_paise_at_accept` (current spot price), `cancel_cutoff_hours_at_accept` (the venue's current value, 12 if the owner has no venue row) and `price_source = 'trigger'`.
  - Leaving `accepted` (cancel, swap release, suspend): clears the lock. A re-accept locks again at that moment's values.
  - Any other update: the four columns cannot change when the write carries JWT claims (PostgREST, including the service role). A write with no claims (the SQL editor) may correct them by hand; the lock and the ended-show refusal always run.
- `comedian_cancel_spot_request` replaced: pending and waitlisted cancels are unchanged. An accepted request is refused with `code: 'show_started'` once `date + start_time` (IST) has passed, and with `code: 'cancel_cutoff_passed'` (plus `cancel_cutoff_hours`) after `start - cancel_cutoff_hours_at_accept`; the `error` text names the deadline and tells the comedian to contact the venue. The spot row is now locked before the checks (it was locked after the update in 016), same request-then-spot order. `venue_cancel_spot_request` is unchanged.
- `accept_spot_request` replaced: the 017a function byte for byte plus one block, after the `spot_cancelled` check and before any write, returning `code: 'show_ended'` with a plain message when `venue_show_is_upcoming(v_spot.date, v_spot.end_time)` is false. The price and cutoff lock are **not** in the function: the trigger covers every path (RPC, swap, waitlist promotion, direct insert, SQL editor). Step 8 replaces this function again.
- Back-fill (before the trigger exists, like 019): accepted requests only, from the spot's current price and the venue's current cutoff, `price_source = 'backfill'`. Pending and waitlisted requests are locked when they are accepted. `price_paise_at_request` stays NULL for all existing rows.
- `venue_show_is_upcoming` (021) uses `now() AT TIME ZONE 'Asia/Kolkata'` against `date + end_time`, so the end-of-show test is correct for IST; the cutoff uses its own `date + start_time` comparison.
- Grants: `price_to_paise`, the trigger function and both replaced functions are REVOKEd from `PUBLIC, anon, authenticated` and GRANTed to `service_role`; the file aborts if any of them is still reachable by anon or authenticated.

### Migration 030: billing foundation (tables, no behaviour)

> **Written 2026-11-13 as `030_billing_foundation.sql`; applied by the owner and verified live the same day.** The text below is the original design; **where it differs, the file and the "Migration 030 record" in section 13 (Step 2) win** (no Route columns, `online_payments_enabled`, `bills.mode`, loose refund fields, stricter guards, and more).

**`billing_settings`** (single row, `id boolean PK CHECK (id)`): `billing_enabled` (global kill switch, default false), `billing_start_date`, `dues_policy_default` ('lenient' | 'strict', default lenient), `due_days` (7), `commission_bps` (0), `fee_share_bps` (270), `auto_send_after_hours` (72), `max_spot_price_paise` (1,000,000), `auto_send_cap_paise` (1,000,000), `min_online_amount_paise` (2000), `dispute_pause_days` (7), `reminder_max` (5), `updated_by`, `updated_at`. Admin-only writes, audited.

**`venue_billing_settings`** (PK `venue_id`): `enabled` (default false), `dues_policy` (owner's choice, nullable = inherit), `dues_policy_admin_override` (nullable; set = locked), `auto_send` (default true), `due_days` (nullable, 3 to 14), `commission_bps_override` (nullable), `razorpay_linked_account_id`, `payout_status` ('none' | 'under_review' | 'active' | 'suspended'), `payout_status_checked_at`. Separate from `venues` on purpose (31). No owner write policy; owners change only their own `dues_policy`, `auto_send`, `due_days` through an RPC that refuses locked values.

**`bills`**: `id`, `bill_number` (sequence-backed, shown as `B-000123`), `venue_id`, `venue_owner_id`, `comedian_id`, `venue_name` and `comedian_name` (snapshots), `week_start`, `status` (`bill_status_enum`: draft, sent, paid, paid_offline, waived, void, refunded), `amount_due_paise`, `commission_bps`, `fee_share_bps`, `commission_paise`, `fee_share_paise`, `venue_net_paise` (all frozen at send), `payment_mode` ('online' | 'offline', frozen at send), `due_at`, `generated_at`, `auto_send_at`, `sent_at`, `sent_by` (NULL = system), `paid_at`, `cleared_at`, `cleared_by`, `clear_reason`, `clear_reference`, `voided_at`, `voided_by`, `void_reason`, `supersedes_bill_id`, `disputed_at`, `dispute_reason`, `dispute_resolved_at`, `dispute_outcome`, `last_reminded_at`, `reminder_count`, `needs_review` (a line was affected after generation), `is_demo`.
- Unique `(venue_id, comedian_id, week_start) WHERE status <> 'void'`; generation additionally refuses when **any** bill (including void) exists for the triple, which is what keeps a discarded draft discarded.
- CHECKs tie fields to status (a `sent` bill has `sent_at` and `due_at`; a `paid` bill has `paid_at`; amounts non-negative; `venue_net_paise >= 0`).
- Immutability trigger: after `sent`, the money columns, `week_start`, `venue_id`, `comedian_id` can never change; `DELETE` is refused (see "Demo exemption" below).

**`bill_lines`**: `id`, `bill_id`, `request_id` (RESTRICT), `show_id`, `venue_name`, `show_date`, `start_time`, `end_time`, `spot_type` (including hosting), `label`, `amount_paise` (>= 0; free spots are ₹0 lines, so a charge always names its show, venue, date and spot type), `active`, `removed_at`, `removed_by`, `removed_reason`, `source_changed_at` (set by a trigger if the request or show is cancelled after the line was created). Unique `(request_id) WHERE active`. Only `active`, the removal fields and `source_changed_at` can change, only through RPCs.

**`billing_payments`** (one row per payment attempt): `id`, `bill_id`, `comedian_id`, `mode` ('test' | 'live'), `reference_id` (unique; sent to Razorpay), `razorpay_payment_link_id` (unique), `short_url`, `expires_at`, `amount_paise`, `venue_net_paise`, `status` (created, captured, expired, cancelled), `razorpay_payment_id` (unique, nullable), `razorpay_order_id`, `method`, `fee_paise`, `tax_paise`, `captured_at`, `transfer_id`, `transfer_status`, `reconcile_flag` (NULL | 'bill_not_payable' | 'duplicate_payment' | 'amount_mismatch'), `reconcile_resolved_at/by/note`, `refund_id`, `refund_status`, `refunded_paise`, `created_at`.
- Unique `(bill_id) WHERE status = 'created'`: **one open attempt per bill** (the double-click and two-tab guard).

**`billing_webhook_events`**: `event_id` (unique, from `X-Razorpay-Event-Id`), `event_type`, `payload jsonb`, `status` (received, processed, failed, ignored), `attempts`, `error`, `received_at`, `processed_at`. Written only after the signature verified. Payloads contain customer contact details, so retention is limited (open question Q16).

**`billing_events`** (the audit log, append-only): `id bigserial`, `bill_id`, `payment_id`, `actor_id`, `actor_role` ('comedian' | 'owner' | 'admin' | 'system' | 'razorpay'), `action`, `from_status`, `to_status`, `amount_paise`, `reason`, `metadata jsonb`, `created_at`. Trigger refuses UPDATE and DELETE and TRUNCATE is revoked; the only way to alter it is a superuser dropping the trigger in the SQL editor, which is documented here as the accepted limit.

**`billing_exceptions`**: `venue_id`, `comedian_id`, `reason`, `created_by`, `created_at`, `expires_at` (nullable), `revoked_at`, `revoked_by`. At most one non-revoked row per pair.

**`notifications`**: `id`, `user_id`, `kind`, `title`, `body`, `link`, `bill_id`, `dedupe_key`, `created_at`, `read_at`. Unique `(user_id, dedupe_key)` makes the reminder job idempotent. Read policy: own rows.

**Read policies:** `bills` and `bill_lines` readable by the comedian (own) and the owner (own venue) when `status <> 'draft'` for comedians; `billing_payments` by the comedian (own) and the owner of the venue; the audit, webhook and exception tables have **no** client policy (service role only). In practice the API reads with the service role, so the policies are defence in depth.

**Demo exemption.** Rows with `is_demo = true` may be deleted (so test fixtures can be cleaned up per `CLAUDE.md`); real rows cannot be deleted through the API or service role. `is_demo` can only be set by the generation function when the venue name starts with `TEST – `.

### Migration 031: generation and lifecycle functions
Service-role only: `billing_generate_week`, `billing_send_bill`, `billing_remove_line`, `billing_clear_bill` (offline | waive), `billing_void_bill`, `billing_reissue_bill`, `billing_reopen_bill`, `billing_open_dispute`, `billing_resolve_dispute`, `billing_add_exception`, `billing_revoke_exception`, `billing_set_venue_settings`, `billing_send_reminder`, `billing_autosend_due`. Each locks the bill row `FOR UPDATE`, checks the allowed transition, writes `billing_events` and any `notifications` in the **same transaction**, and returns `{ success, code, ... }` like the existing RPCs. Each takes `p_expected_status` where a UI action is involved, so a stale click returns `state_changed` instead of acting.

### Migration 032: payment application functions
`billing_create_attempt`, `billing_apply_payment_event`, `billing_apply_refund_event`, `billing_mark_attempt_expired`, `billing_flag_attempt`. These are the only code that sets `paid`, `refunded` or attempt statuses.

### Migration 033: dues gate
`billing_check_dues(venue_producer_id, comedian_id)` (the one definition of "blocked"), triggers on `spot_requests` (INSERT, and UPDATE to `accepted`), and replacements of `apply_to_spot` and `accept_spot_request` that call the check first and return a structured `dues_blocked` result. The trigger is the backstop.

### Migration 034: schedules
`pg_cron` jobs (see section 11). Enabling `pg_cron` / `pg_net` is a Supabase dashboard step, not SQL I can run.

**Migration plan.** Apply in order by hand in the Supabase SQL editor; each file is transactional and additive. 029 is the only one that changes existing behaviour (cancel cutoff, accept-after-show refusal) and the only one with data back-fill. Every new function revokes `PUBLIC`, `anon`, `authenticated`.

---

## 6. Bill state machine

```
                weekly job (system)               owner "send" | system auto-send (72h)
 (no bill) ───────────────────────▶  DRAFT  ─────────────────────────────────────────▶  SENT
                                      │  ▲                                              │ │ │
                    owner/admin       │  │ reissue creates a new DRAFT                  │ │ │
                    discard (reason)  ▼  │ (supersedes_bill_id)                         │ │ │
                                    VOID ◀──────── owner/admin void (reason) ───────────┘ │ │
                                      ▲   (only if no captured payment; link cancelled)   │ │
                                      │                                                   │ │
   PAID ◀──── Razorpay webhook (only path; exact amount) ──────────────────────────────────┘ │
     │                                                                                       │
     │ admin refund (full), completed by refund.processed                 owner/admin, reason│
     ▼                                                                                       ▼
 REFUNDED                                                          PAID_OFFLINE or WAIVED
                                                                           │
                                          admin "reopen" (reason) ◀────────┘  → back to SENT
```

`OVERDUE` is not a state: it is `status = 'sent' AND due_at < now()`. `DISPUTED` is not a state: it is a flag with a 7-day pause.

| From | To | Who can trigger | Conditions |
|---|---|---|---|
| (none) | draft | system (`billing_generate_week`) | complete week, venue enabled, at least one billable line, a total above ₹0, no bill exists for the triple |
| draft | sent | owner (own venue), admin, system auto-send | ≥ 1 active line; total > 0; auto-send also needs no flagged line, total ≤ cap, venue `auto_send` on, review window passed. Freezes amounts, commission, fee share, `payment_mode`, `due_at` |
| draft | void | owner, admin | reason required; weekly job will **not** recreate it |
| sent | paid | webhook only | amount in paise equals `amount_due_paise`; no earlier capture |
| sent | paid_offline | owner, admin | reason required; optional reference (e.g. UPI txn id) |
| sent | waived | owner, admin | reason required |
| sent | void | owner, admin | reason required; no captured payment; every open Razorpay link cancelled first |
| paid | refunded | admin | full refund only; completed by the `refund.processed` webhook |
| paid_offline, waived | sent | admin only (`reopen`) | reason required; due date restarts |
| any other | any | nobody | refused with `code: 'invalid_transition'` |

**Idempotency and concurrency.** Every transition locks the bill row, re-reads the status, and is a no-op that returns success when the bill is already in the target state (a second "send" click or a replayed webhook changes nothing and sends no second notification). Two actors racing (owner "waive" vs admin "paid offline"; owner clear vs webhook): the second one gets `state_changed` with the current status. Nothing is ever changed without a row in `billing_events`.

---

## 7. Razorpay integration

### 7.1 Why Payment Links
The brief wants the comedian "redirected to a Razorpay payment portal" for small amounts. A **Payment Link** is exactly that: a Razorpay-hosted page, no checkout script on our site, UPI-friendly on mobile. Razorpay's docs say Payment Links can carry a Route transfer to a linked account, so the split stays atomic with the payment. The alternative, Orders plus Standard Checkout, needs a script on our pages and is a modal rather than a redirect. Step 0 confirms the transfer parameters in test mode; if Payment Links fail the check, the fallback is Orders and Checkout in redirect mode with no change to the data model.

### 7.2 Flow
1. **Send creates nothing at Razorpay.** Sending a bill is database-only, so a send can never leave a half-created gateway object.
2. **Comedian presses Pay** (`POST /api/me/bills/:id/pay`). The server loads the bill (must be the caller's, `sent`, `payment_mode = 'online'`, the venue's payout account `active`, amount ≥ `min_online_amount_paise`). It uses the existing open attempt if one is unexpired, otherwise creates a Payment Link with: amount = `amount_due_paise` (**computed server-side, never from the request body**), `accept_partial = false`, `reference_id` = our attempt id, `expire_by` (default 24 h or `due_at`, whichever is later and at most 7 days), `notify` off (we do our own notices), `callback_url` to `/dues/[billId]`, notes with the bill id, and the transfer (linked account id, `venue_net_paise`). The row is inserted first with the attempt id as the idempotency key; the unique "one open attempt per bill" index makes two simultaneous presses return the same link.
3. The comedian is redirected to `short_url`. The `callback_url` page **never trusts URL parameters**; it polls `GET /api/me/bills/:id` for up to about 30 seconds showing "Confirming your payment" and then a "refresh" button.
4. **The webhook is the only thing that marks a bill paid** (7.3).

### 7.3 Webhook (security-critical)
- `POST /api/webhooks/razorpay`, mounted with `express.raw({ type: 'application/json', limit: '1mb' })` **before** the global `express.json()` (the one required edit near `index.ts` line 125).
- Verify `X-Razorpay-Signature` as HMAC-SHA256 of the **raw bytes** with `RAZORPAY_WEBHOOK_SECRET` using a constant-time compare. Invalid or missing: 400, nothing stored, nothing logged except a counter. The webhook secret is separate from the API key secret.
- Insert the event into `billing_webhook_events` keyed by `X-Razorpay-Event-Id` (`ON CONFLICT DO NOTHING`). A redelivery of a **processed** event returns 200 immediately. A redelivery of a **failed** event is reprocessed.
- Process through `billing_apply_payment_event` in one transaction; return 200 on success and 500 on a processing error so Razorpay retries (it retries non-2xx for about 24 hours). Failed events stay visible in admin and can be replayed (replay is possible for about 15 days on Razorpay's side; our own store has no such limit).
- Events handled: `payment_link.paid` (the primary signal) with `payment.captured` as a redundant, idempotent second signal (same payment id changes nothing); `payment.failed` (log only; the link stays open for retry); `payment_link.expired` and `payment_link.cancelled` (attempt status only); `refund.created` / `refund.processed` / `refund.failed`; `transfer.processed` / `transfer.failed` (record status, surface failures to admin); `payment.dispute.*` events (**record and flag the bill only**; the workflow is [LATER]). Exact event names are confirmed in Step 0.
- Applying a payment checks, under the bill lock: amount equals the bill amount **and** the attempt amount; currency INR; the payment id is new (`UNIQUE razorpay_payment_id`). If the bill is `sent`: set `paid`. If the bill is `void`, `waived`, `paid_offline`, already `paid` or `refunded`, or the amount differs: store the payment, set `reconcile_flag`, **do not change the bill**, and it appears in the admin refund queue with a notice to admin. Money is never lost and the bill is never wrongly marked paid.
- After a bill becomes paid, any other open attempts for it are cancelled at Razorpay (best effort, repeated by the reconcile job).
- Test and live webhooks use different secrets and different registered endpoints.

### 7.4 Failures, expiry, partial payments, duplicates
- Failed payment: the same link accepts another try until it expires. Expired link: the comedian presses Pay again and gets a new attempt. **Partial payments are forbidden** (`accept_partial = false`; an `amount_mismatch` flag if one ever arrives).
- Duplicate protection: one open attempt per bill (DB-enforced), a paid link closes at Razorpay, and a second captured payment on an already-paid bill is flagged `duplicate_payment` for refund.
- Money in an unknown state (paid at Razorpay, no webhook): the comedian "I've paid, refresh" button (rate-limited) and an admin per-attempt "re-sync" both fetch the link and payment from Razorpay and run the same apply function; a daily reconcile job does the same for every open or recently-expired attempt.

### 7.5 Fees and the transfer
The comedian pays the bill amount. The transfer to the venue is `venue_net_paise = amount − commission − fee_share` (frozen on the bill at send). With 0 commission and the default 270 bps, a ₹500 bill transfers about ₹486.50; the platform keeps ₹13.50 and pays Razorpay the real fee (about ₹11.80 gateway plus ₹1.40 transfer fee at the rates found in Razorpay's examples: 2% + 18% GST, and 0.25% + GST on the transfer). The 270 bps figure is a **placeholder to confirm in Step 0**. The real fee and tax from the payment entity are stored on `billing_payments`, so admin sees the estimate-versus-actual variance. If you later raise commission, only bills sent afterwards change.

### 7.6 Refunds (Phase 1: minimal, not absent)
Admin only, full amount only, via `POST /api/admin/billing/payments/:id/refund` with a reason. The refund request reverses the venue transfer. The bill moves to `refunded` only when `refund.processed` arrives; `refund_status` is tracked on the payment. The same tool refunds orphan and duplicate payments (bill unchanged). Known risk: if the venue's money has already left Razorpay to its bank, the reversal can fail or leave the linked account negative; the platform may have to absorb it (Q10, holds are [LATER]).

### 7.7 Environments and secrets
New env vars (API only, never `NEXT_PUBLIC_*`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MODE` (`test` | `live`), `BILLING_CRON_SECRET`. At startup the API **refuses to boot billing** if the key prefix disagrees with `RAZORPAY_MODE`. Secrets live in Render's env settings and in `apps/api/.env` locally (git-ignored); never in a file git can see. Use a thin typed `fetch` wrapper for the handful of calls (create, fetch, cancel link; fetch payment; create, fetch refund) instead of the SDK, so there is no new dependency in the money path. Webhooks need a public HTTPS URL: in test mode, a tunnel or a Render deploy.

### 7.8 What must exist before going live
Razorpay account KYC complete and live keys issued (lead time of days; start early); Route enabled on the account; linked account for the pilot venue active; webhook registered with the live secret; API deployed with a working production build (currently missing, see findings) on a paid Render instance (the free tier sleeps; Razorpay retries cover short gaps but not a service that is down); web on Vercel **Pro** (the Hobby plan does not allow commercial use); `pg_cron` / `pg_net` enabled; a runbook (Step 11); the tax question answered (Q1).

---

## 8. Dues-blocking policy

**Definition of "owed".** For a comedian and a venue: bills with `status = 'sent'`, `due_at < now()`, and not under an active dispute pause. Draft bills, current-week spots that have not been billed, paid, waived and void bills **never** count.

**Blocked** at venue V means: effective policy for V is `strict` **and** the comedian has an owed bill at V **and** has no active exception at V **and** V has billing enabled. Dues are per venue: owing venue A never blocks booking at venue B. Grace period and amount thresholds are [LATER]; the owner's `due_days` is the practical lever.

**Who wins (effective policy).**

| Admin override on venue | Owner's choice | Global default | Result |
|---|---|---|---|
| set | any | any | **Admin override** (locked; owner UI shows it read-only) |
| none | set | any | Owner's choice (a later change of the global default does **not** override an owner's explicit choice) |
| none | none | set | Global default |

Admin cannot be overridden by the owner; the owner cannot be overridden by the global default. Changing a policy takes effect immediately; switching to strict shows "N comedians owe ₹X here and would be blocked now" and needs confirmation.

**Enforcement points (server-side, all of them).**
1. New request: `apply_to_spot` returns `{ success: false, code: 'dues_blocked', amount_due_paise, bills: [...] }`, **and** a trigger on `spot_requests` INSERT refuses the direct PostgREST path.
2. Accept and waitlist promotion by the owner (the same `accept_spot_request`): same result, **and** a trigger on any UPDATE to `accepted`. The owner sees "this comedian has overdue dues; clear their bill or allow an exception".
3. System 1 `book_show_spot` is out of scope and not gated.
4. As with the 020 venue gate, writes with no JWT claims (SQL editor) are exempt; every API and PostgREST call carries claims and is checked.

**Already-accepted future spots** are untouched when a comedian becomes blocked (default; Q12). Existing pending requests are not cancelled but cannot be accepted while blocked. A comedian can still cancel their own requests.

**What the blocked comedian sees.** Before applying, the venue page (and the spot card) calls `GET /api/me/dues/status?venue_id=` and shows "You owe ₹X at this venue" with a **Pay** button to `/dues/[billId]`. If they still apply, the API returns the structured `dues_blocked` result, which the UI renders the same way, never a generic error.

**Exception.** An owner (or admin) can allow one comedian at one venue despite dues, with a reason and optional expiry; it is revocable, audited, and the comedian is notified.

---

## 9. Manual clearing, adjustments, disputes

**Two different clears (both exist).**
- **Paid offline:** the venue received money outside Razorpay (cash, direct UPI). Optional reference text. Counted as collected-offline in totals; no gateway fee; no transfer.
- **Waived:** nothing is owed. Counted as waived.
Both need a reason (minimum 5 characters), write an audit row (who, when, bill, previous status, amount), notify the comedian, are allowed to the owner on **their own venue's** bills and to admin on any, and are only valid from `sent`. Clearing a bill with an open payment link cancels the link first; if Razorpay reports it already paid, the clear is refused and the webhook decides. Undo is **admin reopen only**.

**Before sending (draft).** The owner can remove a line with a reason (no-show waived, show not held, price error, other). They cannot add lines or edit amounts. The system flags a line whose request or show was cancelled after generation (`source_changed_at`), shows a banner, and **blocks auto-send** of that bill until the owner reviews it.

**After sending.** Sent bills are never edited. To correct one: **void and reissue** (void with a reason, which cancels the link, then a new draft copying the remaining lines that the owner edits and sends; both comedian notices explain it) or **waive** it. Partial waivers do not exist; remove-a-line-and-reissue covers the case.

**Disputes (comedian says "I never attended").** On a `sent` bill the comedian opens a dispute with a reason (minimum 10 characters), once per bill. It pauses reminders and blocking for `dispute_pause_days` (7) and notifies the owner. The owner resolves it: reject (blocking resumes and the comedian cannot dispute again), reissue without the line, or waive. If the owner does nothing, the pause ends on day 7 and normal rules resume; admin sees open disputes.

**Owner and admin acting at once.** Whoever commits first wins; the other gets `state_changed` with the current status and nothing is half-applied.

---

## 10. Edge cases resolved

| Case | Resolution |
|---|---|
| Venue suspended or hidden with bills outstanding | Bills stay payable and clearable by everyone; weekly generation continues for completed weeks (suspension cancels only upcoming shows, so past accepted spots remain billable). Gate irrelevant since the venue takes no requests. Admin can switch billing off for the venue (no new drafts, no auto-send; sent bills remain payable) |
| Venue with no owner | Cannot have spots (spots need an owner), so it never has bills |
| Owner account deleted or deactivated | Hard delete is blocked by `RESTRICT` once bills exist; admin deactivates instead. Comedians can still pay (the transfer targets the linked account) and admin can clear |
| Comedian account with unpaid bills | Cannot be hard-deleted; bills keep a name snapshot |
| Show cancelled by the venue after the week was billed | Line gets `source_changed_at`; owner and admin are notified; draft: remove the line; sent: void/reissue or waive; paid: admin refund |
| Venue suspended after bills were sent | No change to those bills |
| Comedian cancels an accepted spot | Up to the venue's cutoff **as locked at accept**: freed slot, not billed. After the cutoff (`cancel_cutoff_passed`) or after the show starts (`show_started`): refused with a message naming the deadline; the owner can still venue-cancel (not billed). Pending and waitlisted cancels are never restricted |
| Owner accepts after the show ended | Refused by trigger |
| Price edited after acceptance | No effect on the bill (snapshot) |
| Price edited while request pending | Billed at the price when accepted; the request-time price is kept as evidence |
| Comedian pays after being blocked | Webhook marks paid; blocking clears at once |
| Comedian pays but the webhook is late or missing | "Refresh" and reconcile paths (7.4); never marked paid from the browser |
| Payment arrives on a void, waived or already-paid bill | Stored and flagged; admin refund queue |
| Venue loses payout status after a bill was sent | Pay returns "this venue cannot take online payments right now"; owner clears offline; admin is alerted |
| Week whose lines are all ₹0 (free spots) | No bill. ₹0 lines appear only on a bill whose total is above ₹0 |
| Sub-minimum bill (below ₹20) | `payment_mode = 'offline'` |
| Weekly job runs twice, or late, or concurrently | Unique constraint plus catch-up logic make it idempotent and self-healing |
| Self-accepted request via direct PostgREST insert (the RLS follow-up, confirmed open live on 2026-11-08) | Closed by migration `029b` (drops the insert policy and revokes write privileges from `anon` and `authenticated`). Until it is applied: not made worse (the price trigger still snapshots, the dues trigger still applies, the owner can remove the line) |
| System 1 | Out of scope and confirmed untouched: `bills` and `bill_lines` reference only `spot_requests`; no System 1 row is billed; the legacy `payment_*` columns stay unused |
| Tax / GST | **Not decided here.** Q1 |

---

## 11. Notifications, reminders, schedules

**Kinds (in-app, via `notifications`; email is the natural upgrade).** To comedian: bill sent, reminder (due in 2 days, due today, overdue +1, +3, +7 days, capped at `reminder_max` = 5), overdue, payment received (acts as the receipt), cleared offline, waived, voided / reissued, dispute resolved, exception granted, refund issued. To owner: draft ready, auto-send warning (24 h before), payment received, dispute opened, line affected after billing, payout issue. Admin alerts (orphan payment, failed webhook, failed transfer) appear as counters and lists on the admin billing page, not as notices.

**Owner "send reminder"** is allowed once per 24 hours per bill (enforced in the database), not during a dispute pause.

**Receipt.** The paid bill page shows bill number, venue, lines, amounts, payment id, method and time. It is a receipt, **not a GST invoice** (Q1).

**Schedules (`pg_cron`, UTC):**

| Job | When | What |
|---|---|---|
| Generate drafts | Sunday 19:00 UTC (Monday 00:30 IST) | `billing_generate_week` for every complete, unbilled week since `billing_start_date`, for enabled venues; notify owners |
| Auto-send | hourly | drafts past `auto_send_at` that pass the safeguards |
| Reminders | daily 04:00 UTC (09:30 IST) | per cadence above, deduped by `dedupe_key` |
| Reconcile | daily, plus an hourly ping to keep Render warm | `pg_net` calls `POST /api/internal/billing/reconcile` with `BILLING_CRON_SECRET`; syncs open and recently expired attempts with Razorpay |

If the owner never sends: reminders to the owner at 24 h and 48 h, then auto-send at 72 h unless the owner turned `auto_send` off (then the draft stays until acted on and admin sees stale drafts).

---

## 12. API surface (signatures only)

All new routes use `requireUser` + the matching `requireRole`; admin routes live under the existing `/api/admin` guard. Errors follow the existing `{ error }` / `{ success, code, error }` shapes.

**Built in Step 1b (not billing):** `PATCH /api/venues/mine/cancel-cutoff`; `cancel_cutoff_hours` on `GET /api/venues/mine/status`, `GET /api/venues/:id` and `GET /api/admin/manage/venues/:id`; `price_paise_at_accept`, `cancel_cutoff_hours_at_accept`, `cancel_by`, `venue_cancel_cutoff_hours` on `GET /api/spot-requests/mine`. Money is paise at the API edge.

**Comedian**
- `GET /api/me/dues` → bills per venue (sent and history), totals owed
- `GET /api/me/bills/:id` → bill, lines, payments, receipt data
- `POST /api/me/bills/:id/pay` → `{ short_url, expires_at }`
- `POST /api/me/bills/:id/refresh` → re-sync with Razorpay (rate-limited)
- `POST /api/me/bills/:id/dispute` `{ reason }`
- `GET /api/me/dues/status?venue_id=` → `{ blocked, amount_due_paise, bills }`
- `GET /api/me/notifications`, `POST /api/me/notifications/read`

**Venue owner**
- `GET /api/venue-producer/billing/summary?week_start=` → totals collected, outstanding, offline, waived
- `GET /api/venue-producer/billing/bills?week_start=&status=`
- `GET /api/venue-producer/billing/bills/:id`
- `POST .../bills/:id/send`, `.../remind`, `.../clear` `{ kind: 'offline'|'waive', reason, reference? }`, `.../void` `{ reason }`, `.../reissue` `{ reason, remove_line_ids }`
- `POST .../lines/:id/remove` `{ reason_code, reason }`
- `POST .../bills/:id/dispute/resolve` `{ outcome, note }`
- `GET|PATCH /api/venue-producer/billing/settings` (own `dues_policy`, `auto_send`, `due_days`; refuses locked values)
- `GET|POST|DELETE /api/venue-producer/billing/exceptions`

**Admin (`/api/admin/billing/...`)**
- `GET /bills` (filters: venue, city, status, week, flag, search by bill number), `GET /bills/:id` (with audit trail)
- `POST /bills/:id/clear`, `/reopen`, `/void`
- `GET|PATCH /settings` (global); `PATCH /venues/:id` (enable, policy override, linked account id, payout status, commission override)
- `GET /stuck` (open or expired attempts, captured-but-unapplied, flagged payments, failed transfers, failed webhook events)
- `POST /payments/:id/resync`, `POST /payments/:id/refund` `{ reason }`, `POST /webhook-events/:id/reprocess`
- `GET /totals` (collected online, offline, waived, outstanding, estimated fees, by week)

**Other**
- `POST /api/webhooks/razorpay` (raw body, signature, no auth middleware)
- `POST /api/internal/billing/reconcile` (shared secret header, not a user route)

**Rate limits and guards (`express-rate-limit`, keyed by user id, falling back to IP; `trust proxy` configured for Render):** pay 10 per hour per bill and 30 per hour per user; refresh 5 per 10 minutes per bill; dispute and clear 20 per hour; owner reads 120 per minute; admin 240 per minute; webhook protected by signature and body-size cap rather than a per-IP limit. Owners can only act on bills where `venue_owner_id` is them; this is checked in every RPC, not only in the route.

---

## 13. Implementation plan

Order is chosen so the risky Razorpay and webhook core is proven in test mode, with curl and fixtures, **before any UI depends on it**.

### Step 0: Spike and prerequisites (no repo code)
- **Goal:** turn the doc-based assumptions into facts. Create the Razorpay account in test mode, enable Route, create one test linked account in the dashboard, create a Payment Link with a transfer, pay it with test credentials, and record exact request/response shapes.
- **Confirm and write into this spec:** the Payment Link transfer parameter names and whether `reference_id` must be unique; the exact webhook event names and payload fields (`payment_link.paid`, `payment.captured`, refund and transfer events, dispute events); that `X-Razorpay-Event-Id` is present; fee and tax in the payment entity; the reversal behaviour on refund; Route test-mode limits; whether the live account needs Route approval and how long KYC takes; the real fee rates for this account (to replace the 270 bps placeholder).
- **Files:** none in the repo; the scratch script lives in the session scratchpad; this spec's section 7 is updated.
- **Acceptance:** each item above has a recorded answer, or a recorded "docs unclear, choose fallback X".
- **Risks:** Payment Links + Route may not behave as the docs suggest (fallback: Orders + Checkout). Route may need a business entity or approval you do not have yet (then the plan pauses and you decide).
- **Do not touch:** any repo file except this spec.

**Step 0 record (2026-11-13; test mode, no Route; scripts in the session scratchpad, keys only via `node --env-file`, throwaway receiver behind ngrok `reusable-ploy-zap.ngrok-free.dev`). Everything below was observed by running it, except where marked.**
- **Auth.** The first keys returned 401 (mismatched id and secret after a regeneration); after regenerating the pair, `GET /v1/payment_links` returns 200. Plain HTTP Basic auth with key id and secret.
- **Create Payment Link** (`POST /v1/payment_links`, no `transfers`): worked with `amount`, `currency`, `accept_partial: false`, `reference_id`, `description`, `expire_by`, `notify`, `reminder_enable`, `notes`. Response keys: `id` (`plink_...`), `short_url`, `status` (`created`), `reference_id`, `expire_by`, `amount`, `payments`, and others. **Minimum amount is 100 paise**: 99 returns 400 `amount: amount should be minimum 1.00 for INR.` **`reference_id` is unique**: a second create with the same id returns 400 `payment link with given reference_id: ... already exists`; so our attempt id is a safe idempotency key against a retried create.
- **Hosted page.** It asks for a contact number and email first (a valid 10-digit Indian mobile number is required; a dummy such as 9876543210 was rejected, a less obvious one worked). **UPI was not offered on this test account** (card, wallet and netbanking only); cause unknown (test-mode limit or account setting), so the "UPI-friendly" claim in 7.1 is unconfirmed. Netbanking opens a mock bank page with Success and Failure buttons.
- **Webhook transport.** Signed deliveries verified with HMAC-SHA256 of the raw body using the webhook secret (the dashboard secret equals `RAZORPAY_WEBHOOK_SECRET`). **`X-Razorpay-Event-Id` is present on every event and unique per event** (so the event-id idempotency design in 7.3 stands). Headers seen: `x-razorpay-event-id`, `x-razorpay-signature`, `content-type`, `user-agent`, `request-id`. Event envelope keys: `entity`, `account_id`, `event`, `contains`, `payload`, `created_at`.
- **Event names and order (all four seen as named in 7.3).** A failed netbanking attempt then a successful retry on the same link gave: `payment.failed` (entity `payment`), then, about 19 s later, `payment.authorized`, `payment.captured` (entity `payment`) and `payment_link.paid` (entities `order`, `payment`, `payment_link`), about 1 s apart. **Auto-capture is on** (authorized is followed by captured). The link stays open after a failure (the retry worked on the same link). `payment_link.paid` and `payment.captured` both arrive, as the spec assumed. **Caution:** on `payment_link.paid` the envelope's `created_at` equalled the link's creation time, not the payment time, so never use it as the payment time; use the payment entity's `created_at`.
- **Payment entity** (fetched): `status captured`, `method netbanking`, `amount 10000`, `currency INR`, **`fee 260`, `tax 40`** (inferred: `fee` includes `tax`, so about 2.6 % for netbanking here, against the 270 bps placeholder; one method and one payment only, real rates and other methods unconfirmed), `order_id`, `invoice_id null`, `amount_refunded 0`, `refund_status null`, `error_*` fields (null on success), `bank`, `vpa`, `wallet`, `email`, `contact`, `acquirer_data` with the single key `bank_transaction_id`, `notes`.
- **Fetch link** after payment: `status paid`, `amount_paid 10000`, `order_id` now present, `payments` list of `{amount, created_at, method, payment_id, status}`. **Fetch payment** is `GET /v1/payments/:id`.
- **Cancel.** `POST /v1/payment_links/:id/cancel` works (status `cancelled`) and fires `payment_link.cancelled` (entity `payment_link`). Cancelling again returns 400 `cannot cancel or expire a cancelled link`.
- **Expiry.** A link with the minimum 15-minute window (created with 16) went to `expired` about 21 s after `expire_by` and fired `payment_link.expired` (entity `payment_link`).
- **NOT VERIFIED: refunds.** `POST /v1/payments/:id/refund` (documented body: optional `amount`, `speed`, `notes`, `receipt`) returned 400 `invalid request sent` (no other detail) in every variant (no amount, `amount: 10000`, with and without `notes`), and **the dashboard's own "Issue full refund" failed with the same message**, so it is account-side, not our request. Likely cause (hypothesis, unconfirmed): the payment is not settled yet (the dashboard timeline says "to be deposited by Tue 17 Nov 2026 1:00 PM"), so the balance is zero (Razorpay lists "insufficient balance" among refund errors, and the dashboard greyed out "Refund Instantly" for that reason). "Add Funds" is a real-money top-up of a reserve balance (UPI or bank transfer from the registered settlement account) and was deliberately **not** used. **RETRY on or after 2026-11-17** (see `specs/handoff.md`): refund `pay_TzdeUhi84z8paK` (₹100, netbanking) or a fresh payment, then record the `refund.created`, `refund.processed` / `refund.failed` events (names still unconfirmed, though the dashboard subscription accepted them), the refund entity, `fetch-refund`, and whether a refund before settlement is possible at all. Until then the refund handler and the admin refund tool (7.6, Step 4) are written from the docs only and must be treated as untested.
- **Not tested (by design or not reachable):** Route, transfers and transfer events; dispute events; partial payment; UPI, cards and wallets; real fee rates beyond the one netbanking sample; settlement behaviour; behaviour behind a real deployment.
- **Effect on later steps.** Event names and header in 7.3 are confirmed for the six payment-link and payment events; refund events stay open. The fallback "Orders + Checkout" was not needed.

### Step 1: Price lock, venue cancel cutoff, accept-after-show refusal (migration 029)
Split into three diffs (decided 2026-11-08): **1a database, 1b API and types, 1c web.** Each ends with a spec update, `git diff --stat` and an honest verified / not-verified report, and waits for "go".
- **Goal:** start collecting trustworthy prices and a cancel cutoff the comedian knows about, and close the cancel-after-the-show window, before any billing exists. Needs no Razorpay connection.
- **1a Database (written, applied and verified live 2026-11-08):** `029_request_price_snapshot_and_cancel_cutoff.sql` (section 5), this spec, `specs/decisions.md`, `specs/handoff.md`.
- **1b API and types (built and verified live 2026-11-08):** `PATCH /api/venues/mine/cancel-cutoff` (owner only, body `{ cancel_cutoff_hours }`, a JSON integer 0 to 12 or 400, any venue state, only ever the caller's own venue, 404 without a venue; the database CHECK is the backstop); `cancel_cutoff_hours` added to `GET /api/venues/mine/status`, to the public `GET /api/venues/:id` venue object, and (read-only) to the admin venue detail `GET /api/admin/manage/venues/:id`; `GET /api/spot-requests/mine` rows now carry `price_paise_at_accept`, `cancel_cutoff_hours_at_accept` and `cancel_by` (ISO instant, accepted rows only, null otherwise) and `venue_cancel_cutoff_hours` (the venue's cutoff right now, for pending and waitlisted cards); types only in `packages/types`. The accept and cancel routes are unchanged: they pass the database JSON through, so `show_ended`, `show_started` and `cancel_cutoff_passed` already reach the client. `/api/spots` (the older list pages) is deliberately not extended: `app/venues/[id]/page.tsx` is the only place a comedian applies.
- **1c Web (built 2026-11-08; the user's browser check passed):** `src/lib/cancelWindow.ts` (pure helpers: cutoff wording, India-time formatting of `cancel_by`, closed check, paise to rupees); owner section `CancellationWindowSection` on the venue-producer dashboard (a 0 to 12 hour dropdown, Save, toast, shown in every venue state, explains that already-accepted spots keep their window) with `saveCancelCutoff` added to `useOwnerVenueStatus`; the venue page `app/venues/[id]/page.tsx` shows a "Cancelling" note above the spots and a line on every spot card, before the comedian can press Apply (no confirmation dialog, by decision); `SpotRequestCard` shows the locked price and "You can cancel until …" for accepted requests, switches to "Cancellation is closed … contact the venue" and hides the Cancel Spot button once `cancel_by` has passed (a 30 s clock tick; the server stays the authority), and shows "If accepted, you can cancel …" for pending and waitlisted ones; `RemindersSection` passes the fields through; `HostingPriceNote` under the hosting price in the Add and Edit show forms (the host pays); a read-only "Cancellation window" row in the admin dossier; the debug preview page gained sample cards for the new states. The owner's accept-error and the comedian's cancel-error displays needed no change: they already show the server's `error` text, which carries the `show_ended`, `show_started` and `cancel_cutoff_passed` messages.
- **Acceptance (1a, fixtures with the `TEST – ` prefix, service role, all deleted afterwards including `users` rows):** cutoff 13 and -1 rejected, also through an owner login; a direct insert or update cannot set any of the four columns; accept locks price and cutoff; a later price edit or a later owner cutoff change leaves them alone; cancel, swap release and suspend clear the lock; a re-accept re-locks; free spots lock 0, invalid prices lock NULL; with a 12 h cutoff a cancel 13 h before is allowed and 11 h before is refused, with a 0 h cutoff a cancel just before the start is allowed and after the start refused; pending and waitlisted cancels are unrestricted even for a past show; accepting for an ended show returns `show_ended` through the API and is refused by the trigger on a direct write; a text diff of the new `accept_spot_request` against 017a shows only the inserted block; the 017 swap / one-accepted-per-show checks and the 020 gate are re-run; `update_show`, `cancel_show` and suspend still work with accepted requests.
- **Risks:** comedian-visible behaviour changes (accepted requests past their cutoff become uncancellable); `accept_spot_request` is a critical RPC; the new trigger runs on every `spot_requests` write.
- **Do not touch:** `update_show`, `venue_cancel_spot_request`, System 1 functions, `Sidebar`. The RLS insert policy is closed by its own migration, `029b_close_spot_requests_direct_writes.sql`.
- **Deferred:** admin override or lock of the cutoff; the Step 3 task to re-point the price ceiling at `billing_settings`.

**Step 1 record (what was and was not verified)**
- *Read-only live check before applying (2026-11-08, counts only):* 31 spot requests (20 cancelled by venue, 7 by comedian, 2 pending, 2 accepted); both accepted requests are for shows that have already ended, so the back-fill touches 2 rows and no cancellation window is lost; none is free or has an invalid price; 11 venues, no owner with two venues; 1 spot owner has no venue row (the trigger falls back to 12).
- *Offline test (2026-11-08):* 47 checks, 0 failed, on PGlite (an in-process Postgres) with a stub schema plus the real 005, 017a and 019 migrations: back-fill, constraints, `price_to_paise`, forged inserts and updates, accept lock, later price and cutoff changes, free / invalid / no-venue cases, all cancel timings, ended-show refusals (RPC, trigger, direct insert), swap, re-apply with unchanged data, grants. This is **not** the live database: the real 018, 020, 021 and the Supabase roles and RLS were not part of it.
- *Live checks after applying (2026-11-08, real project, through the running API on port 8080; `TEST – 029` fixtures: 1 owner, 4 comedians, 1 approved venue, all deleted afterwards, 0 users and 0 venues left; real data unchanged at 31 requests and 11 venues):* **53 passed, 0 failed.** Covered: the cutoff column (default 12; 13 and -1 rejected by the service role and by an owner login; the owner can set 6; anon can read it); the lock at accept (price at accept 30000 although the request-time price was 15000, cutoff 12, source `trigger`) and its survival of later price and cutoff edits; cancel timing (13.5 h before allowed, 11 h before refused with `cancel_cutoff_passed` and a message naming the deadline, cutoff 0 allowed just before the start, after the start refused with `show_started`, a locked cutoff of 6 beating a later 12); pending and waitlisted cancels on a past show allowed; accept for an ended show returns `show_ended` through the API, and the trigger refuses a direct write and a direct insert; free hosting locks 0, a 20000 price and a 3-decimal price lock NULL, 10000 locks 1000000; waitlist promotion locks at the promotion-time price; the 017 swap rules (`swap_required`, then a successful swap, released request loses its lock); `update_show` with an accepted request leaves the lock alone; `cancel_show` and `admin_suspend_venue` clear it; the 020 gate still refuses a request for a suspended venue; the 2 existing accepted rows were back-filled.
  - **Finding (verified live):** the `spot_requests_insert_own` hole from `specs/spot-requests-rls-insert-followup.md` is open. A comedian login can insert a row with `status: 'accepted'` directly through PostgREST (a direct UPDATE affects 0 rows). 029 does not make it worse (forged values were overwritten by the trigger), but a comedian can still accept themselves without the owner and that spot would be billable. **Must be fixed before real money flows** (fixed by 029b, below); its own task, recommended before Step 4 (Razorpay core) goes anywhere near live. **Fix written 2026-11-08 as `029b_close_spot_requests_direct_writes.sql`; not yet applied** (see below).
  - **Not covered:** the venue_shows / spots parts of the 020 gate; concurrent races (cancel vs accept at the cutoff, two accepts); suspension through the admin API route (the function was called directly); the owner dashboard and comedian UI (diff 1c); the `/api/spot-requests/mine` payload (diff 1b); a second run for flakiness.
- *Diff 1b, live checks (2026-11-08, real project, through the running API; `TEST – 1b` fixtures: 4 owners (approved, pending, suspended, no venue), 1 promoted admin, 2 comedians, all deleted afterwards, 0 users and 0 venues left):* **51 passed, 0 failed.** Role matrix on the new route (no token 401, bogus token 401, comedian 403, admin 403, owner 200); validation (13, -1, 6.5, "6", null, true, missing, 1000 all 400 with the stored value unchanged; 0 and 12 accepted); scoping (owner B changes only B's venue; pending and suspended venues may set it; no venue gives 404); reads (owner status, public venue detail, admin detail include the field; the public route is still 404 for pending, suspended and hidden venues and still has no `owner_id`; the admin detail still has no `address`; an admin cannot edit the cutoff; an owner cannot read the admin route); `/mine` (accepted row has price 15000, cutoff 5 and a `cancel_by` equal to show start minus 5 h within 15 s, which checks the IST offset; after the owner changes the cutoff to 9 the accepted row keeps 5 and the same `cancel_by` while the pending row shows 9; free hosting gives 0; an invalid price gives null; cancelled rows have null lock fields; every old key is present; another comedian sees none of these rows; owner 403 and no token 401); a late-cancel refusal reaches the client with its code and message. Static: the API's ad hoc `tsc` shows only the 13 old errors, `npm run check-types` (web) passes, `/api/health` answers after the types change.
- *Diff 1b, not covered:* anything visual, and whether the web consumes these fields (diff 1c).
- *Migration 029b (written, applied by the user and verified live 2026-11-08):* drops `spot_requests_insert_own` and revokes all table privileges on `spot_requests` from `PUBLIC, anon, authenticated`, then grants `SELECT` back to `authenticated` (the two read policies keep working); it aborts if the result is not exactly that. Checked beforehand: the web app never touches the table through the Supabase client, the API only uses the service-role client for it, and every function that writes it is SECURITY DEFINER. Offline test on PGlite with real roles and RLS: 11 checks, 0 failed (before: a comedian can insert an accepted row; after: insert, update and delete are denied, a comedian still reads their own rows, an owner still reads requests for their spots, anon cannot read, the service role still writes, re-apply is clean). **Live checks after applying (2026-11-08, real project, `TEST – 029b` fixtures: 1 owner, 3 comedians, 1 approved venue, all deleted, 0 users and 0 venues left, real data still 31 requests with 2 accepted): 25 passed, 0 failed.** With a comedian login through PostgREST: an insert with `status: 'accepted'` is denied, a plain pending insert is denied too, an update and a delete are denied or affect nothing, and no row was created; a comedian still reads their own request, another comedian cannot, the owner still reads requests for their own spot, anon cannot read. Through the API: apply, accept, a waitlisted request becoming waitlisted when the pool fills and then being promoted, comedian cancel, accepting into another pool, venue-cancel, `/api/spot-requests/mine`, the owner request list and a fresh apply and accept all work. SECURITY DEFINER functions and the service role still write: `update_show`, `cancel_show`, `admin_suspend_venue` / `admin_unsuspend_venue`, a service-role insert. *Test note:* the first run reported one failure that was a wrong expectation in my script (a request applied after the pool is full is `pending`, not `waitlisted`; `apply_to_spot` always inserts `pending`), fixed and rerun clean. *Not covered:* the exact privilege list as the database reports it (checked behaviourally and by the migration's own abort check, not by querying `information_schema`).
- *Diff 1c, checks (2026-11-08):* `npm run check-types` passes; ESLint on every changed file exits 0; `cancelWindow.ts` has 29 helper checks, 0 failed (cutoff wording for 0, 1 and 12 hours; India-time formatting including midnight and year-end rollover; the closed check at the exact deadline, one second either side, and for unknown or invalid input; paise formatting). The helper tests found one real bug, `formatPaise(1050)` printed ₹10.5 instead of ₹10.50, now fixed and retested. Through the running dev server (port 3000): `/debug-spot-card-preview` renders the new states (the pending line with its cutoff, the locked price line with "fixed when you were accepted", "You can cancel until 7:30 PM on 1 Jan (India time).", the closed message, and "Free"), the closed card has no Cancel Spot button while the other five cards with a cancel handler do; `/home`, `/venues/:id` and `/admin/venues/:id` compile (HTTP 200, no error markers). The data these screens read was verified live in 1b.
- *Diff 1c, not done by me:* no `next build` (a dev server was running on port 3000 and a build would overwrite its `.next` folder); no browser check of the signed-in flows (owner saves the cutoff, the venue page note and card lines with real data, the real request cards, the admin row) and no mobile-width check; both were left to the user, who then checked the screens in a browser and reported that everything works (which flows and widths were covered was not itemised).

### Step 2: Billing foundation (migration 030), no behaviour
- **Goal:** all tables, enums, constraints, immutability and audit triggers, RLS, settings rows, with billing off.
- **Files:** `030_billing_foundation.sql`; `packages/types` (types only, **no new runtime export**; the shared package's startup trap applies, so the API is started and `/api/health` checked after any change there).
- **API / UI:** none.
- **Acceptance:** migration applies cleanly and re-applies safely; anon and authenticated roles cannot insert, update or delete any billing table (checked with real anon/user tokens); a bill past `sent` rejects changes to money columns; `billing_events` rejects UPDATE, DELETE; demo rows delete, real rows do not; unique indexes reject a second non-void bill for a triple and a second open attempt.
- **Risks:** table design is hard to change later; get review before applying.
- **Do not touch:** existing tables beyond FKs; `venues` columns.

**Step 2b record (2026-11-13): env scaffolding, built; migration 030 (2c) NOT started.**
- **Built:** `.gitignore` (root) gains `.env.*` and `!.env.example`; `apps/web/.gitignore` gains `!.env.example` (its own `.env*` rule would otherwise still hide the template, because a nested ignore file wins over the root one); `apps/api/.env.example` and `apps/web/.env.example` (names, placeholders and what each is for; the web template says no Razorpay secret ever goes there); `CLAUDE.md` env table gains the five Razorpay variables plus a line that real values live in the untracked env files and are never printed, logged or committed; `apps/api/src/billing/config.ts` (pure checks: `checkRazorpayConfig`, `modeMismatchProblem`, `getApiPort`, `isDeployed`, `webhookPortNote`, `buildStartupReport`); `apps/api/src/billing/startup.ts` (reads the billing flag once, builds the report, prints it, exits when required); two lines in `apps/api/src/index.ts` (import, and `await runBillingStartupCheck()` before `app.listen`). **One file more than planned (`startup.ts`)** so that `config.ts` stays free of database code and testable with fake objects.
- **Rules as built.** Variables are `RAZORPAY_KEY_ID` (must start `rzp_test_` or `rzp_live_`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MODE` (exactly `test` or `live`); blank values and values with leading/trailing spaces or quotes are reported by name; the key prefix versus `RAZORPAY_MODE` mismatch is reported in every environment; `BILLING_CRON_SECRET` is only required when asked (Step 10). The API exits only when `NODE_ENV=production` **and** billing is on **or its flag could not be read** (a database hiccup never silently skips the check) **and** the config is incomplete. A missing `billing_settings` table (Supabase returns `PGRST205`, observed) means billing off, so until 030 is applied the exit path cannot trigger. Every log line carries variable names and plain text only; no value is printed.
- **Start-up note** (every start): `[billing] Razorpay webhook: the tunnel must forward to this API's port <PORT> (route /api/webhooks/razorpay, added in Step 4; until then a throwaway receiver is used).` It shows the API's own port (8080 here), **not 8788**: 8788 is only the throwaway receiver's port, so at Step 4 ngrok must be re-pointed at the API port.
- **Verified:** 45 fake-env checks, 0 failed (port rule; every variable missing, blank and whitespace-only; bad prefix, bad mode, trailing space, quotes; mismatch both ways; cron secret optional then required; the dev / production x billing on, off, unknown matrix; a scan that no fake secret value appears in any output across 7 scenarios). API ad hoc `tsc`: the 13 old errors only, none in `src/billing` (a first version had one extra error, `abortSignal` after `maybeSingle`, fixed). **Real starts on a spare port (8099, your dev server on 8080 untouched and still healthy):** dev start with the real `.env` prints the note and "config: complete (mode test)" and `/api/health` answers 200; a `NODE_ENV=production` start with the real complete config starts and answers 200; a `NODE_ENV=production` start with the Supabase URL pointed at a dead local address (flag unreadable) and `RAZORPAY_KEY_ID` and `RAZORPAY_WEBHOOK_SECRET` blanked for that process exits with code 1, names the two missing variables, and does not listen. `git check-ignore`: every real env file is ignored and both `.env.example` files are committable.
- **Not verified:** the `billing_enabled = true` read with a real table (needs 030, 2c); the 503 guard on billing routes and the "enable billing" refusal (Step 3 and later); `next build`; anything on a real deployment.

**Migration 030 record (2c, written 2026-11-13, applied by the owner and verified live the same day). Step 2 is complete.**
- **File:** `apps/api/src/db/migrations/030_billing_foundation.sql` (one transaction, safe to re-run, ends with a check that aborts the whole migration if RLS, grants or the seed row are wrong). No callable function, API or UI; `CLAUDE.md`'s "migrations 001…" line is to be updated to `001…030` only after the owner confirms it is applied.
- **Decisions applied (owner, 2026-11-13):** keep `razorpay_*` column names; `venue_billing_settings.dues_policy` is NULL = inherit the global default (lenient), so new venues start off; the guards are always on for everyone including the SQL editor (no JWT-claims exemption like the 020 gate; accepted limit: a superuser can disable a trigger by hand); demo-row deletes also remove their audit rows while real rows' audit records stay protected; `fee_share_bps` default 270; the retention settings are 180 / 180 days and 6 months.
- **Where it differs from the section 5 text above (the file wins):** no Route columns (`razorpay_linked_account_id`, `payout_status`, `transfer_id`, `transfer_status`, `venue_net_paise` on payments); `venue_billing_settings.online_payments_enabled` added; `bills.mode` added (rule B1); `billing_payments` gains `captured_amount_paise` (the actual amount, for `amount_mismatch`), its `razorpay_payment_link_id` is NULL until the link exists (row first, then the Razorpay call), `reference_id` is capped at 40 characters, `amount_paise >= 100` (Razorpay's minimum, verified), and **`refund_status` and the refund fields are deliberately unconstrained until the refund test has run**; `billing_webhook_events` gains `mode` and `payload_stripped_at` (a stripped row keeps its event id and type); `billing_events` has the approved fixed columns plus `is_demo`, with plain uuid columns and no foreign keys; `notifications.user_id` and `bill_id` cascade (notices are not money records); `billing_settings` also has `min_online_amount_paise >= 100` (default 2000) and `due_days` 3 to 14.
- **Guards beyond the spec's acceptance list (all always on):** a bill can only be created as a draft; a bill's identity (number, venue, comedian, week, names, mode, demo flag) never changes; once `sent_at` is set the money columns, `payment_mode`, `sent_at` and `sent_by` are frozen (`due_at` is not: an admin reopen restarts it); lines can only be added to a draft bill, their snapshot fields never change and a removed line stays removed; a payment attempt can only be opened for a SENT, ONLINE bill of the same comedian and mode for exactly the bill amount, its identity and Razorpay ids never change once set, and a finished attempt stays finished; the `billing_settings` row cannot be deleted. The audit row's `is_demo` is copied from its bill by a trigger (never caller-supplied) and `bills.is_demo` can never change, so no one can turn a real bill into a demo to delete its audit rows. Real bills, lines and payments cannot be deleted; only demo rows can (cleanup order: audit, payments, lines, bills).
- **The only change to existing tables:** two AFTER triggers, one on `spot_requests` (status leaves `accepted`) and one on `venue_shows` (cancelled), which set `source_changed_at` on any active bill line from that request or show and `needs_review` on its bill. They match nothing while no line exists and never block the original write.
- **Verified offline (2026-11-13):** 255 checks, 0 failed, three runs, on PGlite 0.5.16 (PostgreSQL 18) with stub versions of `users`, `venues`, `venue_shows`, `spots`, `spot_requests`, real roles (`anon`, `authenticated`, `service_role`), Supabase-style DEFAULT grants (so the REVOKEs are really tested) and RLS. Covered: apply and re-apply (an admin-changed setting survives); every table closed to anon and to authenticated writes and TRUNCATE, `service_role` cannot TRUNCATE; sequence and trigger-function privileges; settings CHECKs and the single row; every bill rule above (draft-only creation, frozen identity and money, all status-field CHECKs, one live bill per venue, comedian and week with void freeing the slot, delete rules for real and demo bills, RESTRICT on users and venues); lines (draft-only, snapshot frozen, one active line per request, removal rules, no re-activation, the flag triggers for a swapped or cancelled request and a cancelled show, delete rules); payment attempts (one open attempt, wrong amount, comedian or mode refused, identity and Razorpay ids frozen, finished attempts final, refund cap, delete rules); webhook events; audit (UPDATE and TRUNCATE refused, a caller-supplied demo flag overwritten, real rows undeletable even by the superuser, demo rows deletable); exceptions and notifications; RLS visibility for a comedian (non-draft only, active lines only), an owner (own venue incl. drafts), a second owner and a stranger; demo cleanup leaving real records intact. **The test found one real bug, fixed before this record:** the CHECKs for `void_reason`, `clear_reason` and `dispute_reason` let a NULL reason through (`char_length(NULL) >= 5` is NULL, which a CHECK treats as passing); they now use `COALESCE`, with tests for the exact case.
- **Not covered offline:** the real Supabase roles and default privileges (emulated, not the real thing; the migration's own end-of-file check aborts it if any grant is wrong); the real triggers on `spot_requests` and `venue_shows` (017a, 019, 020, 029 and the real RPCs were not present, only stubs); concurrency; `auth.uid()` as Supabase defines it; the SQL editor's behaviour with the file.
- **Live checks (2026-11-13, real project, service role plus real anon and user tokens; `TEST – 030` fixtures: 1 owner, 3 comedians, 1 venue approved through the real `admin_approve_venue`, 2 shows with spot pools, 3 requests applied and accepted through the real `apply_to_spot` and `accept_spot_request`, 3 bills, 3 lines, 1 payment attempt, audit, webhook, exception and notification rows; all deleted afterwards, including the `public.users` rows and the auth users):** **160 passed, 0 failed.** The first run was 159 of 160: the one failure was my script's cleanup missing a test webhook-event row; it left that row behind, the script was fixed, the row swept, and the full run repeated clean. Covered: all 9 tables reachable through the API; the seed row (billing off, defaults and retention as designed); for every table, `anon` and a signed-in comedian (and an owner) refused INSERT, UPDATE and DELETE with `42501`, and refused SELECT on the 5 tables that have no client policy, including `billing_settings` and the audit table; the 4 readable tables answer for a comedian but are policy-limited; bill rules (draft-only creation, `B-######` numbers, Monday week check, TEST – venue name for demo bills, one live bill per venue, comedian and week, frozen money and payment mode after send, frozen identity incl. the demo flag, split-must-add-up, the NULL-reason CHECK trap, `needs_review` still settable on a sent bill); line rules (one active line per request, snapshots frozen, no lines on a sent bill); payment-attempt rules (one open attempt per bill, wrong amount and draft bill refused, 40-character reference cap, link id and amount frozen, captured needs a payment id); audit rows (demo flag copied from the bill and a caller-supplied value ignored, UPDATE refused); duplicate webhook event id and duplicate notification key refused; a second live exception refused; RLS visibility with real tokens (a comedian sees own SENT bill and its ACTIVE lines but not their draft; another comedian and a stranger see nothing; the owner sees all bills, lines and attempts of their venue including drafts; notifications are own-only; the owner and the comedian cannot write bills); RESTRICT on users, venues and bills with lines and the undeletable settings row; the **flag triggers through the real RPCs** (`venue_cancel_spot_request`, `comedian_cancel_spot_request` and `cancel_show` all still succeed with a billed line and each flags the line and sets `needs_review`, including on a SENT bill whose money stays frozen); the existing 029 price lock (15000 paise at accept) still works; a comedian can re-apply after a flagged cancel. Afterwards an independent count showed real data unchanged (19 users, 11 venues, 11 shows, 19 spots, 31 requests), every billing table empty except the settings row, and no test users left in auth.
- **Not covered live:** protection of a REAL (non-demo) bill's audit rows, lines and payments against deletion (testing it would leave rows that can never be deleted; covered offline, 255 checks); concurrency; the 017 swap rules, the 020 gate refusals, `update_show` and `admin_suspend_venue` were not re-run this time (only apply, accept, the three cancel RPCs and the price lock were); no API route or UI exists for billing yet, so nothing was exercised through the web app.
- **Types and start-up (2026-11-13):** types-only additions in `packages/types` (`BillStatus`, `BillingMode`, `DuesPolicy`, `BillPaymentMode`, `BillDisputeOutcome`, `PaymentAttemptStatus`, `PaymentReconcileFlag`, `BillingAuditAction`, `BillingActorRole`, `WebhookEventStatus`, and the row interfaces `BillingSettings`, `VenueBillingSettings`, `Bill`, `BillLine`, `BillingPayment`, `BillingAuditEvent`, `BillingException`, `BillingNotification`); the only runtime export is still `deriveDisplayStatus`. `npm run check-types` passes; the API's ad hoc `tsc` shows only the 13 old errors; the API starts in dev and in `NODE_ENV=production` mode on a spare port and `/api/health` answers 200; the start-up flag read now returns the row (`billing_enabled: false`); the owner's dev server on 8080 stayed healthy. `CLAUDE.md` now says migrations run `001`…`030`.

### Step 3: Generation and lifecycle functions (migration 031) plus thin API
**Status: NOT STARTED. Not yet planned in chat; the owner has not said "go". The bullets below are the original outline only.**
- **Goal:** weekly draft generation and every non-payment transition, callable with curl; no UI.
- **Files:** `031_billing_generation_and_lifecycle.sql`; `apps/api/src/billing/` (route registration), a two-line registration in `index.ts`.
- **API:** owner and admin routes for list, detail, send, remove line, clear, void, reissue, dispute, reopen, settings, exceptions (section 12), with rate limits (adds `express-rate-limit`).
- **Acceptance:** generation matches 4.2 exactly on fixtures (accepted yes (including hosting and free ₹0 spots); pending, waitlisted, both cancelled kinds, cancelled shows, wrong week, before `billing_start_date`, disabled venue no); run twice and concurrently → no duplicates; discarded draft is not recreated; every transition in the table works and every other is refused; double send, double clear, and send-vs-clear races end consistent with one audit row each; an owner cannot act on another venue's bill (403/`forbidden`); comedian cannot see drafts; every audit row has actor, from, to, reason.
- **Risks:** this step holds most business rules; reviewed line by line against sections 4 to 6 and 9.
- **Do not touch:** any Razorpay code, web files.
- **Deferred:** scheduling (Step 10).

### Step 4: Razorpay core: attempts, webhook, apply, reconcile, refund (migration 032)
- **Goal:** the risky part, proven in test mode before any UI.
- **Files:** `032_billing_payment_apply.sql`; `apps/api/src/billing/razorpay.ts` (the thin client), `webhook.ts`; `index.ts` edit: mount the webhook before `express.json()`, plus the startup mode guard.
- **API:** `POST /api/me/bills/:id/pay`, `/refresh`, the webhook, `POST /api/internal/billing/reconcile`, admin `resync`, `refund`, `reprocess`, `GET /stuck`.
- **Acceptance (test keys, demo bills, tunnel):** pay with a test UPI/card succeeds and the bill becomes `paid` only via the webhook; the venue's linked account receives the expected net; tampered body or wrong secret → 400 and nothing stored; the same event replayed five times → one state change; `payment_link.paid` and `payment.captured` both delivered → one change; two simultaneous Pay presses → one link; a second payment on a paid bill → `duplicate_payment`; payment on a voided bill → `bill_not_payable`; wrong amount → `amount_mismatch`; expired link then new attempt works; webhook down for an hour then restored → events apply; reconcile applies a payment whose webhook was missed; full refund reaches `refunded` only after `refund.processed`; a processing error returns 500 and the replay tool recovers it; key/mode mismatch refuses to start.
- **Risks:** highest in the plan; every Razorpay field name comes from Step 0's findings, not memory; the admin gets the stuck-payment list in this step because it is how failures are seen.
- **Do not touch:** web files; dues gate.
- **Deferred:** transfer holds; dispute workflow.

### Step 5: Admin: payout setup, venue billing settings, global settings
- **Goal:** the admin can enable billing for a pilot venue, enter its linked account id and payout status, set policy overrides and commission, and edit global settings.
- **Files:** `apps/web/app/admin/billing/settings` (or a panel on the venue dossier `admin/venues/[id]`; decided at the step's plan, default a new section reusing existing dossier components), `src/hooks/`; admin routes from section 12.
- **Acceptance:** enable/disable per venue works; commission and policy changes are audited and apply only to bills sent afterwards; an owner cannot read or write the admin-only fields through PostgREST; the guard still shows the standard 404 for non-admins.
- **Do not touch:** `Sidebar`, the existing venue edit PATCH validation, photo rules.
- **Deferred:** self-serve linked-account onboarding.

### Step 6: Comedian "My dues" and pay
- **Goal:** `app/dues/` (list per venue, line items, status, history, receipts) and `app/dues/[billId]` (detail, Pay, polling callback, dispute). Every charge shows its show, venue, date and spot type (hosting included); Step 7 shows the same to the owner.
- **Files:** `apps/web/app/dues/**`, `src/components/billing/`, `src/hooks/useMyDues`, entry link from `/home` (no `Sidebar` change by default; Q11).
- **Acceptance:** shows only the caller's non-draft bills; Pay opens the Razorpay page; returning shows "Confirming" then the paid receipt; refusing to trust URL parameters is verified by visiting the callback URL for an unpaid bill; mobile layout checked; a comedian cannot open another's bill id (404).
- **Do not touch:** booking pages, owner dashboard.

### Step 7: Venue owner billing dashboard
- **Goal:** `app/billing/` per-week view: a row per comedian with status, totals collected vs outstanding vs offline vs waived, actions (review lines, remove with reason, send, remind, clear, void, reissue, resolve dispute, exceptions), settings (policy, auto-send, due days), payout status banner.
- **Files:** `apps/web/app/billing/**`, `src/components/billing/`, entry from the venue-producer home.
- **Acceptance:** every action works against the Step 3/4 APIs; stale-state clicks show the "changed, refresh" message; strict-switch confirmation shows the count; bills in `draft` are visible only here.
- **Do not touch:** `VenueDetailSheet`, show creation flows.

### Step 8: Dues gate (migration 033)
- **Goal:** blocking enforced everywhere, with the clear message.
- **Files:** `033_dues_gate.sql`; apply/accept UI messaging in the venue page and owner request list.
- **Acceptance:** a lenient venue never blocks; a strict venue blocks only for `sent` + overdue + not disputed + no exception; draft/current-week never block; direct PostgREST insert blocked; accept and waitlist promotion blocked; already-accepted future spots untouched; admin override beats owner, owner beats global; paying unblocks immediately; exception works and expires; owing venue A does not block venue B; SQL-editor writes still work; the existing 020 gate and 017 swap behaviour still pass.
- **Risks:** this changes the behaviour of two critical RPCs; re-run the full spot-request test list.
- **Do not touch:** System 1 functions.

### Step 9: Admin oversight pages
- **Goal:** `app/admin/billing/` list (filters: venue, city, status, week, flags) and bill detail with audit trail, stuck payments, refund queue, totals, manual clear/reopen/void, webhook event list and replay; a Billing tile on `AdminHomeContent`.
- **Acceptance:** filters combine; stuck list matches seeded failure fixtures; address is never selected or shown (standing admin rule); totals reconcile with the sum of bills.
- **Do not touch:** Pulse stats, existing venue pages beyond the one tile.

### Step 10: Schedules, reminders, auto-send (migration 034)
- **Goal:** the system runs without anyone remembering to click.
- **Acceptance:** each job is idempotent when run twice; a missed run is repaired by the next; reminders respect dispute pauses and `reminder_max`; auto-send obeys every safeguard; the reconcile job works with the shared secret and refuses without it; notices are not duplicated.
- **Risks:** `pg_cron` / `pg_net` are enabled by you in the Supabase dashboard; the reconcile call needs a reachable API.

### Step 11: Hardening and go-live
- **Goal:** one pilot venue, real money, small.
- **Checklist:** Q1 answered; production build and deploy for the API (currently missing); paid Render instance; Vercel Pro; live keys and live webhook secret set; mode guard confirmed in live; linked account active; `billing_start_date` set; one pilot venue enabled; first live payment of a small amount made by you and refunded; webhook failure alert reviewed; runbook written (a short section here: how to replay an event, resync a payment, refund, reopen a bill, switch billing off per venue and globally).
- **Acceptance:** end-to-end live payment and refund; switching `billing_enabled` off stops generation, auto-send and reminders but leaves paying and clearing of existing bills working.

---

## 14. Test plan

**Method.** Per `CLAUDE.md`: no staging database, so live checks use fixtures named `TEST – ` created with the service role, never touching real venues or users, and **everything deleted afterwards including `users` rows** (demo bills are deletable for this reason). Scripts live in the session scratchpad; no credentials in files git can see. Razorpay checks use **test mode** keys and Razorpay's test payment methods; money in tests is fake.

**Concurrency and replay cases (must pass before Step 11):** two simultaneous sends; send racing void; clear racing webhook; owner clear racing admin clear; two Pay presses; Pay racing void; generation run twice in parallel; reconcile racing the webhook; accept racing comedian cancel at the cutoff; strict-switch racing a booking; webhook replayed 5x; `payment_link.paid` and `payment.captured` together; webhook out of order (refund before paid is rejected, not applied); failed-then-replayed webhook; invalid signature; wrong amount; wrong currency; payment on void / waived / paid / refunded bills.

**Authorization cases:** each endpoint with no token (401), wrong role (403), another owner's or comedian's id (404/`forbidden`); billing tables via PostgREST with anon and user tokens (no rows, no writes); locked policy cannot be changed by the owner; draft bills invisible to the comedian.

**Demo without real money.** A scratchpad script creates `TEST – ` venues, owners, comedians, shows and accepted requests in several weeks, runs `billing_generate_week(..., demo)`, and moves bills into each state (draft, sent, overdue, paid via a real Razorpay **test-mode** payment, offline, waived, void, refunded, disputed, flagged). The UIs are then walked through as each role, and the script deletes every fixture. There is no "simulate payment" endpoint in the product.

**Report format (per `CLAUDE.md`):** each step ends with what was verified live, what was only reasoned, and what was not checked.

---

## 15. Security summary

Amount computed on the server only; webhook is the sole source of "paid"; raw-body HMAC with constant-time compare; event-id idempotency plus unique payment ids; one open attempt per bill; every transition under a row lock with an audit row in the same transaction; money tables writable only by service-role functions; `REVOKE`/`GRANT` on every function; owner scoping enforced in the database, not only the route; secrets only in API env; mode guard; no PAN, bank or card data ever touches this app; rate limits on every new route; webhook payloads are never logged. Gaps accepted: a superuser can alter data in the SQL editor; the pre-existing RLS insert hole is closed by migration 029b and must be applied before real money flows; a compromised Razorpay account is outside this design.

---

## 16. Deferred [LATER]

Combined "pay all" view across venues; email/SMS/WhatsApp notices (Resend is the natural upgrade, and is flagged as the biggest launch risk); GST invoices (pending Q1); self-serve linked-account onboarding; transfer holds and a refund window; partial refunds; chargeback/dispute-from-bank workflow beyond recording and flagging; admin override or lock of the venue's cancel cutoff; grace period and amount threshold for blocking; owner 10-minute self-undo of a clear; rolling small balances into the next week; discount lines or partial waivers; manual "regenerate this week"; comedian dispute-rate reporting; payout reports and CSV export; attendance tracking; automatic retry of failed transfers; webhook payload retention job; global notification bell in the navbar; auto-refund of orphan payments.

---

## 17. Open questions (each with my recommended default)

| # | Question | Recommended default |
|---|---|---|
| Q1 | **Tax.** Are GST invoices needed on bills or on your commission? Who is the supplier of the spot (venue or platform)? | **No default; needs your accountant.** Until answered, receipts say "receipt" not "invoice", and commission stays 0 |
| Q2 | Are hosting spots billed? A host may be paid, not charged | **Answered 2026-11-08:** the host pays; billed like any pool (a free hosting spot is a ₹0 line). Owners are told in the show form that the host pays the hosting price |
| Q3 | Cancellation cutoff | **Answered 2026-11-08:** a venue setting chosen by the owner, whole hours 0 to 12, default and maximum 12, locked onto the request at accept; never after the show starts |
| Q4 | Global dues policy default | `lenient` until a few weeks of real data |
| Q5 | Due date | 7 days after sending, owner can pick 3 to 14 |
| Q6 | Auto-send | On by default after 72 h with the safeguards; owner can opt out |
| Q7 | Minimum online amount | ₹20; below that, offline only |
| Q8 | Per-bill cap for auto-send, per-spot price ceiling | ₹10,000 each; larger needs manual send |
| Q9 | Fee share estimate | 270 bps, replaced by Step 0's real numbers |
| Q10 | Transfer holds before venue payout | None in Phase 1; accept the refund-after-settlement risk, admin-only refunds |
| Q11 | Navigation entry for My dues and Billing | Cards on the existing home pages; no `Sidebar` or `Navbar` change unless you approve |
| Q12 | Already-accepted future spots when a comedian becomes blocked | Untouched |
| Q13 | Pilot plan and `billing_start_date` | One trusted venue; start date = the first Monday at least one week after Step 1 is live |
| Q14 | No-shows | Billed; owner can remove the line at review |
| Q15 | Dispute pause | 7 days, one dispute per bill |
| Q16 | Retention of webhook payloads | Keep 90 days, then strip the payload keeping the event id and type |
| Q17 | Hosting costs | Render paid instance and Vercel Pro before live |
| Q18 | Who onboards linked accounts | You, in the Razorpay dashboard, entering the account id in admin |
| Q19 | Refunds | Admin only, full, reason required |
| Q20 | Who bears a failed or negative-balance reversal | The platform (you), with a visible admin queue |
| Q21 | Email before wide launch | Strongly recommended even though deferred; at minimum, owners get a "copy bill link" to share on WhatsApp |
| Q22 | Billing code location | `apps/api/src/billing/` registered from `index.ts` |
| Q23 | Razorpay SDK vs thin `fetch` client | Thin `fetch` client; no new money-path dependency |
| Q24 | Payment Links vs Orders + Checkout | Payment Links; confirmed or reversed in Step 0 |

---

## What was and was not verified (at spec time)

**Verified by reading:** the schema and every function named above; the middleware order and absence of rate limiting, raw-body handling and scheduling; the gate and trigger patterns; the suspend scope; the notice mechanisms; the absence of payment code apart from the legacy System 1 columns.

**From Razorpay's public docs via search, not executed:** the standard rate (2% + 18% GST on UPI, cards and netbanking), the Route transfer fee (0.25% + GST per the docs' worked example, not a rate card), that Payment Links can carry transfers, webhook retries for 24 hours, the event-id header, raw-body HMAC verification, and the 15-day replay limit. Parameter and event names are **not** confirmed and are Step 0's job.

**Not verified:** anything about your Razorpay account (KYC state, Route approval, your actual fee schedule); `pg_cron` / `pg_net` availability on your Supabase plan; whether Payment Links work with Route in test mode; the timezone behaviour of `venue_show_is_upcoming`; the live grants on `spot_requests` for the `authenticated` role (same unknown as the RLS follow-up spec).

# Handoff: start Step 6b (suspend / unsuspend UI)

Written 2026-10-18 at the end of a session, for a fresh session with no context. Every statement below was checked in the repo or in that session; "assumed" marks what was not. **Do not write code or a plan until you have done section 5 and the user has answered the section 3 questions.**

## 1. Where we are

### Steps done
Steps 0 to 4 (admin guard, review state, acceptance history, Page A, review actions, owner status panel, suspend backend, public-path enforcement, security fixes) are built and verified live; details are in `specs/admin-venue-management.md`. Since then:

- **Step 5 (search and filters on Page A)**: built, API verified live (62 checks). Name-only search, status and city filters, server-side, `{ venues, counts, cities }` response. UI was reviewed by the user.
- **Step 6a (read-only Page B at `/admin/venues/[id]`)**: built; API and migration 026 verified live (67 checks, 0 failed). The page was seen in a browser by the user ("I can see /admin/venues/[id] with all the venue details"); mobile layout and the modals have not been confirmed by the user.

### What 6a shows on `/admin/venues/[id]` right now
- Header: name, status badge, city, owner name and email, "All venues" back link.
- **Situation** panel (`VenueSituationPanel.tsx`): display status, since when / by whom, the current admin note, an "Also hidden" row when relevant. Flags only, no counts.
- **Next actions** panel (`VenueNextActions.tsx`): pending: Approve / Request changes / Reject; changes requested: Approve / Reject; rejected: Move back to pending; Hide or Unhide on any venue that is not suspended. **Approved venues have no Suspend button and suspended venues show no buttons at all** (the panel only says "Suspended. Hide and unhide are paused until the suspension is lifted.").
- **Profile** panel (`VenueProfilePanel.tsx`): read only: name, city, description, photo URLs as text (first marked "Cover"), Instagram, X, Maps, contact email, contact phone. No Edit button.
- Page A: venue names in rows (`VenueListItem.tsx`) and review cards (`VenueReviewCard.tsx`) link to Page B.

### Git state (checked with `git status` and `git log` at the end of the session)
- Branch `main`, HEAD `98e3537`. **Nothing from Step 5 or 6a is committed.** Uncommitted: modified `apps/api/src/index.ts`, `apps/web/app/admin/venues/page.tsx`, `apps/web/next.config.js`, `apps/web/src/components/admin/{ReviewActionModal,VenueListItem,VenueReviewCard}.tsx`, `apps/web/src/hooks/useAdminVenueList.ts`, `apps/web/src/lib/venueStatus.ts`, `packages/types/{index.ts,package.json}`, `specs/admin-venue-management.md`; untracked `apps/api/src/db/migrations/026_hide_audit_and_state_checks.sql`, `apps/web/app/admin/venues/[id]/`, `apps/web/src/components/admin/{VenueFilterBar,VenueNextActions,VenueProfilePanel,VenueSituationPanel}.tsx`, `apps/web/src/hooks/useAdminVenue.ts`, `apps/web/src/lib/adminVenueActions.ts`, `specs/decisions.md`.
- Step 5 and 6a changes are interleaved in the same files (`index.ts`, `packages/types/index.ts`, the spec), so they cannot be split into two clean commits without `git add -p`. The user commits; never stash, reset or check out uncommitted files (use `git diff` / `git show`).

### Migrations (files in `apps/api/src/db/migrations/`)
- **022, 022b, 023, 024, 025**: applied and verified live (2026-10-15/16), per the spec.
- **026** (`hidden_at`, `hidden_by`, state-aware hide/unhide taking `p_admin_id`, extended owner-protect trigger): **applied by the user (their message: "successfully ran 026") and verified live** by the 67-check run on 2026-10-18.
- No other migration is pending. 6b needs none unless question 1 below is answered "yes".

### Deferred
- **6b**: suspend / unsuspend UI (this handoff).
- **6c**: edit mode, `PhotoUrlListEditor`, shared validator, photo-host allowlist, `PATCH /api/admin/manage/venues/:id`, unsaved-changes warning.
- Step 7 (stats on Page B), Step 8 (`/home` cleanup, must be last).
- `specs/decisions.md`: a partial backfill of earlier decisions was started and **paused by the user**. It is a final step after implementation, done one area at a time when the user asks. Do not mention it ahead of the task. The partial draft lives only in an old session scratchpad; leave it alone.

## 2. Decisions already made (do not re-ask)

### Step 6
- **Split in three diffs** (6a, 6b, 6c); 6a is done.
- **Migration 026**: additive `hidden_at`, `hidden_by`; state-aware `admin_hide_venue(uuid, text, uuid DEFAULT NULL)` / `admin_unhide_venue(uuid, uuid DEFAULT NULL)`; service-role only. Venues hidden before 026 show "time not recorded".
- **Hide/Unhide are available in every status except suspended** (refused with 409 by a read in the route, not in the RPC).
- **Situation panel shows flags only**; counts belong to Step 7.
- **Edit semantics (6c)**: unknown keys on `PATCH` get 400; send only changed fields; edits allowed in every status; **no owner notification for admin edits (deferred)**.
- **Photo editor (6c)**: up/down reorder buttons, the first photo labelled "Cover", no thumbnail previews.
- **Unsaved-changes warning (6c)**: `beforeunload` plus the page's own Cancel/Back links only; clicks on the navbar or sidebar are not intercepted (known limitation).
- **Page A filters stay plain React state** (no URL sync), so coming back from Page B resets them (known limitation).
- **Photo host allowlist (built in 6c)**: `picsum.photos`, `images.unsplash.com`, and our Supabase Storage host (`wfyqomxasthwdlpqttno.supabase.co`) restricted to `/storage/v1/object/public/**`; validated in the API and mirrored in `next/image` `remotePatterns` in `apps/web/next.config.js`. https only, at most 8 photos, each at most 2048 characters. Single source of truth wanted: plan is a plain ESM file in `packages/types` (e.g. `photoHosts.js` + `.d.ts`) importable by `next.config.js`, the API and the web code, verified before relying on it; if `next.config.js` cannot import it, two copies with a comment in each pointing at the other. The validator must be reusable by a future owner flow. **No upload feature now.**

### Step 5 decisions that still matter
- Server-side filtering; `GET /api/admin/manage/venues` returns `{ venues, counts, cities }`; counts follow `q` and `city` but ignore `status`; the city list is the distinct cities in the data (full set, not narrowed); search debounced 250 ms with the previous list kept on screen; name-only search, truncated to 100 characters (not a 400).
- The display-status rule lives once, as `deriveDisplayStatus` in `packages/types/index.ts`, used by the API and the web app. `@repo/types` is now `"type": "module"` and `apps/web/next.config.js` has `transpilePackages: ['@repo/types']`. **A re-export from a sibling file failed under Node ESM; the function must stay defined in `index.ts`. `next build` passing does not prove the API starts, so after any change to `@repo/types` start the API too.**

### Known gaps and caveats already logged (do not rediscover)
- **API production caveat**: `apps/api` has no tsconfig and its `build` (`tsc`) does not produce a working `dist`; running it as plain `node dist/index.js` would fail on the runtime import of the `.ts` package. Dev under `tsx` works. No deployment approach chosen.
- **Owner photo URL gap (read from code, not exercised)**: the owner `PATCH` endpoints cannot save photos, but `venues_protect_moderation` does not cover `photos` and the owner RLS policies only check ownership, so an owner can probably write any photo URL directly through PostgREST, which could break `next/image` on public pages. Flagged, not changed.
- **Existing venue "Pune Comedy Club"** has a photo on `http://localhost:3000/pune-comedy-club.jpeg` (not an allowed host, not public).
- The older `/home` routes `POST /api/venues/:id/hide|unhide` now return `{ success: false }` on a repeat (visible change from 026).
- `spot_requests_insert_own` RLS policy is too permissive (`specs/spot-requests-rls-insert-followup.md`); undecided.
- `POST /api/bookings/:id/confirm` is unauthenticated (test helper).
- Rules that stand: address is out of scope everywhere (never select it in new code); no "verified" feature; do not touch comedian features, payments or user management; DB changes are additive and applied by the user.

## 3. 6b open questions (copied verbatim from the previous report; all UNANSWERED)

**Open questions and risks**
1. **Owner notification.** Should Suspend also insert a `venue_notices` row so the owner sees it in "Notices from Admin" like a hide? That would be a small SQL change to `admin_suspend_venue` (a new migration). I lean toward yes, but it's your call. The alternative is banner only.
2. **Legacy bookings are not cancelled.** A comedian with an old-system booking at that venue keeps it. This was decided in Step 4a ("gate only"). The modal's counts won't include those, so the copy shouldn't imply everything is cancelled.
3. **Unsuspend restores nothing.** The modal must say so plainly. Cancelled shows and requests stay cancelled, and the owner must recreate them. This was decided already.
4. **The reason is erased on unsuspend.** There's no audit log, so once lifted, nothing records that or why the venue was suspended. Do you want to accept that until the audit log exists?
5. **Preview vs reality.** The counts in the modal are a snapshot. Between preview and confirm, a comedian can request a spot or an owner can add a show. The suspend response carries the real numbers, so I'd show those in the toast. There is also a documented narrow race where a show created at the very instant of suspending isn't cancelled.
6. **"Upcoming" definition.** A show currently in progress counts as upcoming and gets cancelled, using Indian time. Confirm that's what you want admins to see in the modal wording.
7. **One venue per owner is assumed.** If an owner ever had two venues, suspending one would cancel both venues' shows. True in current data.
8. **Type-the-name confirmation.** This is friction by design. Venue names with unusual characters or very long names are awkward to type. I'd compare after trimming and ignoring case, unless you want exact match.
9. **Hidden plus suspended.** Hide and Unhide stay paused while suspended, and after Unsuspend the venue is still hidden if it was before. I'd mention that in the modal.
10. **Dead-end state while 6b is pending.** Until 6b ships, an admin can't lift a suspension from the UI. The API path exists but is curl-only.

(Items 2 and 3 restate decisions recorded in `specs/admin-venue-management.md`, "Decisions already made" and "Step 4a". They are listed here exactly as asked.)

## 4. What already exists for suspend / unsuspend

**Backend (all built in Step 4a, migration applied, verified live on 2026-10-15):**
- Migration `apps/api/src/db/migrations/021_venue_suspension.sql`: `venue_show_is_upcoming(date, end_time)` (Asia/Kolkata, a show in progress counts as upcoming), `venue_suspension_preview(venue_id)`, `admin_suspend_venue(venue_id, reason, admin_id)` (only from approved and not already suspended; reason required; one transaction; cancels the owner's upcoming shows, pools and pending/accepted/waitlisted requests with fixed neutral texts), `admin_unsuspend_venue(venue_id, admin_id)` (clears the four suspension fields, restores nothing). All `service_role` only. It writes no `venue_notices` row.
- API in `apps/api/src/index.ts` (under the `/api/admin` guard): `GET /api/admin/manage/venues/:id/suspension-preview`, `POST .../:id/suspend` (`{ reason }`, trimmed, at most 500 characters), `POST .../:id/unsuspend`. Mapping: non-UUID or unknown venue 404, wrong state 409 with the RPC message, missing reason 400. They go through `runVenueReviewAction`.
- `AdminVenueDetail` (`packages/types/index.ts`) already carries `is_suspended`, `suspension_reason`, `suspended_at`, `suspended_by_name`.

**Frontend:** **the web app calls none of the three routes.** No Suspend or Unsuspend control exists. The only suspend-related web code is display: `VenueNextActions.tsx` (comments at lines 18-19 and the suspended branch), `VenueSituationPanel.tsx`, `StatusBadge.tsx`, `lib/venueStatus.ts`, and the owner banner in `components/venue-dashboard/VenueStatusSection.tsx` and `VenueProducerDashboard.tsx`.

**Reusable pieces for 6b:** `ModalShell` (`src/components/ModalShell.tsx`), `ReviewActionModal.tsx` (reason textarea pattern with counter and "owner will read" preview), `CtaButton`, `float-field`, `src/lib/adminVenueActions.ts` (`runVenueAction`), `src/hooks/useAdminVenue.ts`, `StatusBadge`, `ReasonNote`. The spec's Step 6 brief also names a new `SuspendVenueModal`, a `ConfirmByTyping` component, and hook methods `getSuspensionPreview`, `suspendVenue`, `unsuspendVenue`.

## 5. How the next session should start

1. Read `CLAUDE.md`, `specs/admin-venue-management.md` (especially "Working rules", "Step 4a", "Step 6a" and the Step 6 brief) and this file.
2. Verify the repo against this note: `git status`, `git log --oneline -5`, the migrations folder, and that `026_hide_audit_and_state_checks.sql` is present. **Tell the user about any mismatch** (for example if the user has committed since, or if `026` is not actually applied; a quick check is that `GET /api/admin/manage/venues/:id` returns 200 rather than 500 for an existing venue).
3. **Write no code and no plan yet.** First restate what 6b will implement, whether it is backend-only or visible in the UI, and which files it touches, then wait for the user's answers to the 10 questions above.
4. Follow the standing workflow: investigate first; a written plan in chat for approval before touching files; tight scope; one step at a time; show `git diff --stat` at the end (it will mix with uncommitted Step 5 and 6a work, so list the 6b files explicitly); update `specs/admin-venue-management.md`; add only **short** entries to `specs/decisions.md` (a few lines each).
5. Working conventions: before every Bash command give a one-line explanation (CLAUDE.md); say honestly what was and was not verified; never claim SQL has run unless the user applied it.

### Practical notes
- Dev servers: web on :3000, API on :8080. Check with `lsof -nP -iTCP:8080 -sTCP:LISTEN` and `curl localhost:8080/api/health` before starting another; if something holds the port, report the PID and ask before killing. **Never use `pkill -f tsx`** (it also kills the user's own API); kill only a PID you started.
- Typecheck: `npm run check-types`; the API has no tsconfig, so use `cd apps/api && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck src/index.ts` and compare against the 13 old errors. ESLint takes explicit file paths. Also run `npx next build` in `apps/web`.
- Live testing: test accounts (admin, owner, comedian) and the approved test venue "ZZ Claude Test Venue" exist in the real database; credentials are not in the repo (see memory `reference_test-accounts`; if the old session files are gone, set a new password with the service-role client). Create extra fixtures with a "TEST – " name prefix, never touch the user's own venues, and delete what you created. **Fixture trap:** a venue inserted as `pending` with `is_active = false` is rewritten to `rejected` by the legacy sync trigger, so pending fixtures need `is_active = true`; approved fixtures should use `is_active = false` to stay non-public. Test scripts from earlier sessions were in session scratchpads, not the repo.
- Suspend has side effects on real data (it cancels shows and requests), so test it only on a "TEST – " venue with its own fixtures, not on the shared test venue unless the user agrees.

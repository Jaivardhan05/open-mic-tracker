# Handoff: admin venue management, after Step 6 (6a, 6b, 6c all built)

Written 2026-10-19 for a brand-new session with no context. It replaces `specs/handoff-6b.md`, which is now out of date (it says Step 5 / 6a are uncommitted and 6b is unstarted). Everything below was checked in the repo or in the sessions it describes; "not verified" marks what was not. **Do not touch any file until the user says "go" (section 6).**

## 0. Differences from what the user's handoff request assumed (read first)

The request for this handoff listed some items as pending that were actually finished before it was written:

- **The 027 live API checks were run, not pending.** They were folded into the 6c test run (94 checks, 0 failed). Details in section 5 and in the spec's "Step 6c" section.
- **6c is built**, not "next". Only its browser check by the user is outstanding.
- **Migration 027 is applied** (the user confirmed: "027 was applied").
- The one genuinely unrun check is the **rollback of a failed notice insert** (could not be forced safely).

## 1. Where we are

Feature: admin venue management (`/admin/venues` = Page A, `/admin/venues/[id]` = Page B). Step 6 (Page B) was split into three diffs.

| Diff | What | State |
|---|---|---|
| 6a | Read-only Page B: situation, next actions (approve / request changes / reject / reopen / hide / unhide), read-only profile; migration 026 | **Built, committed** in `d49aa4e`. API verified live (67 checks). The user has seen the page in a browser. |
| 6b | Suspend / unsuspend UI (`SuspendVenueModal`, `ConfirmByTyping`, Suspend and Lift suspension buttons) + migration 027 (owner notice on suspend) | **Built, uncommitted.** 027 applied. The user checked the UI in a browser ("everything works perfectly"). Live API checks passed. |
| 6c | Edit mode on Page B (admin `PATCH`, shared validator with caps, photo-host module, `VenueProfileEditor`, `PhotoUrlListEditor`) | **Built, uncommitted.** Live API checks passed (94 together with 6b). **The editor UI has NOT been seen in a browser by the user yet.** |
| Step 7 | Venue stats panel on Page B | **Not started. Next.** |
| Step 8 | `/home` cleanup | Not started. **Must be last.** |

Earlier steps (0 to 5, migrations 018 to 026) are done and recorded in `specs/admin-venue-management.md`.

## 2. Git state (captured 2026-10-19)

Branch `main`. HEAD `d49aa4e ADMIN features-step 6` (contains Step 5 and 6a). Previous: `98e3537`, `897c041`. **Nothing from 6b or 6c is committed.** The user commits; never stash, reset or check out uncommitted files (use `git diff` / `git show`).

`git status --short`:

```
 M apps/api/src/index.ts
 M apps/web/app/admin/venues/[id]/page.tsx
 M apps/web/next.config.js
 M apps/web/src/components/admin/ReviewActionModal.tsx
 M apps/web/src/components/admin/VenueNextActions.tsx
 M apps/web/src/components/admin/VenueProfilePanel.tsx
 M apps/web/src/hooks/useAdminVenue.ts
 M apps/web/src/lib/adminVenueActions.ts
 M packages/types/index.ts
 M specs/admin-venue-management.md
 M specs/decisions.md
?? apps/api/src/db/migrations/027_suspend_owner_notice.sql
?? apps/web/src/components/admin/ConfirmByTyping.tsx
?? apps/web/src/components/admin/PhotoUrlListEditor.tsx
?? apps/web/src/components/admin/SuspendVenueModal.tsx
?? apps/web/src/components/admin/VenueProfileEditor.tsx
?? packages/types/photoHosts.d.ts
?? packages/types/photoHosts.js
```

`git diff --stat` (tracked files only; untracked files are not in it):

```
 apps/api/src/index.ts                              | 216 ++++++++++++++++-----
 apps/web/app/admin/venues/[id]/page.tsx            |  61 +++++-
 apps/web/next.config.js                            |   9 +-
 .../web/src/components/admin/ReviewActionModal.tsx |   9 +
 apps/web/src/components/admin/VenueNextActions.tsx |  21 +-
 .../web/src/components/admin/VenueProfilePanel.tsx |  57 +++++-
 apps/web/src/hooks/useAdminVenue.ts                | 103 +++++++++-
 apps/web/src/lib/adminVenueActions.ts              |   3 +-
 packages/types/index.ts                            |   2 +
 specs/admin-venue-management.md                    |  49 ++++-
 specs/decisions.md                                 |  12 ++
 11 files changed, 467 insertions(+), 75 deletions(-)
```

Untracked (line counts): `027_suspend_owner_notice.sql` 117, `ConfirmByTyping.tsx` 38, `PhotoUrlListEditor.tsx` 141, `SuspendVenueModal.tsx` 198, `VenueProfileEditor.tsx` 257, `photoHosts.js` 77, `photoHosts.d.ts` 12.

### Every file touched, and what changed

**6b**
- `apps/api/src/db/migrations/027_suspend_owner_notice.sql` (new): replaces only `admin_suspend_venue`; the 021 body plus an `INSERT INTO venue_notices` ("Your venue was suspended: <reason>") in the same transaction; skipped when the venue has no owner; no `EXCEPTION` block; `REVOKE`/`GRANT` to `service_role` re-asserted.
- `apps/web/src/components/admin/SuspendVenueModal.tsx` (new): one modal on `ModalShell`: venue name, warning, live preview counts (loading and retry states), snapshot note, bullet list of consequences, required reason (<= 500, "owner will read" note), `ConfirmByTyping`, danger "Suspend venue" button; double-submit locked; not dismissible while running.
- `apps/web/src/components/admin/ConfirmByTyping.tsx` (new): `float-input` plus `matchesTypedWord` (trim, ignore case).
- `apps/web/src/components/admin/ReviewActionModal.tsx`: new `unsuspend` kind (plain confirm, "Lift suspension").
- `apps/web/src/components/admin/VenueNextActions.tsx`: danger **Suspend** on approved (not suspended) venues; **Lift suspension** on suspended venues; `onAction` type widened to include `"suspend"`; lead text for suspended reworded.
- `apps/web/src/lib/adminVenueActions.ts`: `unsuspend` added to `VenueActionKind` and `PATH`.
- `apps/web/src/hooks/useAdminVenue.ts`: `getSuspensionPreview`, `suspendVenue` (returns real counts), types `SuspensionPreview`, `SuspendCounts`.
- `apps/web/app/admin/venues/[id]/page.tsx`: renders `SuspendVenueModal`, suspend toast with real counts, `unsuspend` toast.

**6c**
- `packages/types/photoHosts.js` + `photoHosts.d.ts` (new, plain ESM): `PHOTO_HOSTS`, `PHOTO_MAX_COUNT` (8), `PHOTO_URL_MAX_LENGTH` (2048), `photoRemotePatterns()`, `photoUrlError()`, `validatePhotoUrls()`.
- `apps/web/next.config.js`: `images.remotePatterns` now built from `photoRemotePatterns()` (imports `@repo/types/photoHosts.js`).
- `apps/api/src/index.ts`: imports `validatePhotoUrls`; new `validateVenueFields` (owner PATCH checks extracted, plus caps and optional photos); `applyVenueEditableUpdates` now calls it; `loadAdminVenueDetail` extracted from the GET route; new `PATCH /api/admin/manage/venues/:id`; detail response gains `allowed_cities`.
- `packages/types/index.ts`: `AdminVenueDetail.allowed_cities: string[]`.
- `apps/web/src/components/admin/VenueProfileEditor.tsx` (new): the edit form (see spec). `PhotoUrlListEditor.tsx` (new): ordered photo URL inputs.
- `apps/web/src/components/admin/VenueProfilePanel.tsx`: now a client component with an Edit button that swaps the read view for the editor.
- `apps/web/src/hooks/useAdminVenue.ts`: `updateVenue(changes)`, type `AdminVenueChanges`.
- `apps/web/app/admin/venues/[id]/page.tsx`: `handleSaveProfile`, unsaved-changes state, `BackLink` asks to discard.

**Docs**
- `specs/admin-venue-management.md`: new "Step 6b" and "Step 6c" sections, status row updated.
- `specs/decisions.md`: four short entries (027 notice, typing "Suspend", shared validator and caps, photo module).

## 3. Migrations (explicit status for every one)

| Migration | Status |
|---|---|
| 018, 019, 020 | **Applied** (user confirmed, per the spec) |
| 021 (suspension RPCs) | **Applied**, verified live 2026-10-15 |
| 022, 022b | **Applied** |
| 023 | **Applied**, verified live |
| 024, 025 | **Applied**, verified live |
| 026 (hide audit, state checks) | **Applied** (user: "successfully ran 026"), verified live (67 checks) |
| **027 (suspend owner notice)** | **Applied** (user: "027 was applied"); verified live in the 6c run |
| Any other | **None written and unapplied.** 7 and 8 need no migration as planned; Step 7 may need one only if a stats query is moved into SQL (not planned). |

SQL can't run locally; the user applies migrations in the Supabase SQL editor. Never claim SQL has run unless the user said they applied it.

## 4. Decisions (final; do not re-ask)

### 6b
1. **Suspend adds a "Notices from Admin" row** for the owner (migration 027, text "Your venue was suspended: <reason>") **plus** the existing dashboard banner. Unsuspend sends no notice.
2. **Confirmation flow:** the admin clicks **Suspend**, a warning modal opens (the venue will be suspended and taken off /venues, upcoming shows and their requests are cancelled, venue name shown, counts and other details), and the admin types **"Suspend"** (trim, ignore case) to enable the final button. **No venue-name typing.** The reason is also required, in the same modal.
3. **Legacy bookings are not cancelled**, and the modal copy says so. Legacy venues are mostly mock: don't over-invest in legacy-only handling (only build legacy features that help future real venues).
4. **Unsuspend restores nothing** (cancelled shows and requests stay cancelled; the owner recreates shows); the unsuspend modal says so.
5. **The reason is erased on unsuspend** (accepted until an audit log exists); the suspend modal says nothing records it once lifted.
6. **Modal counts are a snapshot**; the toast shows the real numbers from the suspend response.
7. **A show in progress counts as upcoming**, in Asia/Kolkata (IST).
8. **One venue per owner** for now (multi-venue later).
9. **A hidden venue stays hidden after unsuspend**; the modal mentions it. Hide and Unhide stay paused while suspended.

### 6c
10. **Length caps in the shared validator for both owner and admin paths:** links 2048, email 254, phone 32. The user required checking existing data first: done before 6c was built (read-only query on 2026-10-18; 12 venues; longest link 66, nothing near the other caps; **no value exceeded any cap**).
11. **Admin edit whitelist:** name, city, description, photos, instagram_url, x_url, maps_url, contact_email, contact_phone. Unknown keys get 400; only changed fields are sent and validated; edits allowed in every status (suspended included); **no owner notification for admin edits (deferred)**; address never selected, edited or displayed.
12. **Photos:** URL only, https, at most 8, each at most 2048; hosts `picsum.photos`, `images.unsplash.com`, and `wfyqomxasthwdlpqttno.supabase.co` restricted to `/storage/v1/object/public/**`. Up/down reorder, first labelled "Cover", no thumbnails, no uploads. Photos are accepted on the admin path only; owners still can't save photos.
13. **Unsaved-changes warning:** `beforeunload` plus the page's own Cancel and "All venues" link (`window.confirm`). Navbar and sidebar clicks are not intercepted (known limitation).
14. **Page A filters stay plain React state** (no URL sync), so returning from Page B resets them (known limitation).

## 5. Pending work, in order

1. **User:** check the 6c editor in a browser (layout, mobile, reorder, discard prompts, saving, an error case such as a bad photo host). Not verified by anyone yet.
2. **User:** commit 6b and 6c when satisfied (the user commits; suggest it, don't do it).
3. **Step 7: venue stats on Page B.** Plan first (see section 6). Brief is in the spec under "Step 7": `GET /api/admin/manage/venues/:id/stats` and a "pulse" panel (large Bebas "requests received" figure, flat stacked outcome bar in the Requests-panel colors pending `#facc15`, accepted `#38bdf8`, waitlisted `#a1a1aa`, acceptance-rate SVG ring, spots created = number of `venue_shows` for `venues.owner_id`, cancellations by venue / by comedian / after acceptance). Follow the migration 019 rules (acceptance rate over "knowable" requests; older cancelled requests excluded and counted; "n/a" with a note, never a proxy). Ownerless venues show zeros / "no owner". The legacy `shows` table is not part of the stats. Flat colors only, no gradients or glow; SVG icons only.
4. **Step 8: `/home` cleanup (last).** Replace the pending list and `ManageVenuesSection` in `AdminHomeContent` with a count tile linking to `/admin/venues`; retire `useAdminVenues`, `ManageVenuesSection`, `HideVenueDialog`, `VenueActionSheet`, `GET /api/admin/venues`, `GET /api/admin/pending-venues`, and the old unreasoned `POST /api/venues/:id/approve|reject`; update `specs/admin-dashboard-spec.md`. Leave `AdminProfile` and the shared Sidebar alone.
5. **At the very end:** delete the test accounts and test venue (see `reference_test-accounts` memory), and tell the user. `specs/decisions.md` backfill of earlier decisions was started and **paused by the user**; do it only when asked, one area at a time; don't mention it ahead of the task.

### The 027 live checks (done; recorded here because the user asked for them to be tracked)
Run on "TEST – 6c" fixtures as part of the 94-check script: preview counts equal the suspend response; refused calls (no token, comedian, owner, blank reason) add no notice; suspend writes **exactly one** notice with the right text, owner and venue; a repeat suspend is 409 with **no second notice**; unsuspend adds none and keeps the hidden flag; an **ownerless** approved venue suspends with **no notice**; a pending venue is 409. **Still not tested:** a forced rollback when the notice insert fails.

## 6. Workflow state

- **The 6c plan was posted and the user answered its two questions** (caps in the shared validator after a data check; fold in the 027 checks), and 6c was then built. That step is complete; its `git diff --stat` and report were shown. The user has not yet said anything about the 6c editor UI.
- **The Step 7 plan has NOT been posted, and the user has NOT said "go" for Step 7.** The next session must: read the files in section 8, verify the repo against this note, then write a plan in chat (what Step 7 implements, files, SQL or no SQL, how it will be tested) and **wait for the user's "go" before touching any file.** Do not assume approval.
- Standing workflow (the user's rules): investigate first; plan in chat for approval; tight scope; one step at a time; update `specs/admin-venue-management.md`; add only **short** entries to `specs/decisions.md`; show `git diff --stat` at the end and list the step's files explicitly (new files are not in `git diff --stat`); say honestly what was and was not verified; DB changes are additive and applied by the user.
- Project conventions (`CLAUDE.md`): **before every Bash command give a one-line explanation of what it does and why.**

## 7. Uncommitted, half-finished, known issues, gotchas

### Uncommitted / unverified
- All of 6b and 6c is uncommitted (section 2). The 6c editor UI is unseen in a browser.
- Build/verification record for 6b and 6c: `npm run check-types` passed, ESLint on the changed files clean, `next build` passed, API typecheck still shows exactly the **13 old errors**, the running API (tsx watch) reloaded and served the new route. `next build` prints a "Next.js inferred your workspace root" warning (multiple lockfiles); seen, not investigated, not caused by this work as far as known.

### Behavior changes the user should be aware of
- **Owners are now stricter:** the shared validator refuses owner link values over 2048, email over 254 and phone over 32 characters (verified live). Existing data is under the caps.
- The older `/home` hide/unhide routes return `{ success: false }` on a repeat (from 026).

### Known gaps (logged, not fixed)
- **Owner PATCH response includes `address`** (the pre-existing select in `applyVenueEditableUpdates` returns it to the owner's own client). Not touched; address is out of scope for new code.
- **Owner photo URL gap:** `venues_protect_moderation` does not cover `photos`, and owner RLS only checks ownership, so an owner can probably write any photo URL via PostgREST and break `next/image` on public pages. Flagged, not changed; decide before any owner image feature.
- Existing venue **"Pune Comedy Club"** has a photo on `http://localhost:3000/pune-comedy-club.jpeg` (not an allowed host; not public). The editor and API do not re-validate untouched photos, so it doesn't block saving other fields.
- **API production caveat:** `apps/api` has no tsconfig and its `build` (`tsc`) doesn't produce a working `dist`; running plain `node dist/index.js` would fail on the runtime imports of the `.ts`/`.js` workspace package. Dev under `tsx` works. No deployment approach chosen.
- `POST /api/bookings/:id/confirm` is unauthenticated (test helper); `spot_requests_insert_own` RLS is too permissive (`specs/spot-requests-rls-insert-followup.md`); `AdminProfile` still shows the old two-state venue badge.
- Admin edits don't notify owners (deferred). The suspend race (a show created at the very instant of suspending) is documented and unguarded. The rollback of a failed 027 notice insert is untested.

### Gotchas
- **`@repo/types` is `"type": "module"`, and has two runtime exports:** `deriveDisplayStatus` (must stay defined in `index.ts`; a re-export from a sibling file failed under Node ESM) and `photoHosts.js`, imported by deep path `@repo/types/photoHosts.js` (the package has no `exports` map). `next build` passing does not prove the API starts: after any change to `@repo/types`, also confirm the API starts (`curl localhost:8080/api/health`).
- **Dev servers:** web :3000, API :8080 (tsx watch, auto-reloads). Check with `lsof -nP -iTCP:8080 -sTCP:LISTEN` and `curl localhost:8080/api/health` before starting another; report any PID holding a port and ask before killing. **Never `pkill -f tsx`.**
- **Typecheck:** `npm run check-types` (web, ui, types; API excluded). API: `cd apps/api && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck src/index.ts` and expect the 13 old errors only. ESLint takes explicit file paths (no directories). zsh doesn't word-split unquoted `$var`.
- The shell's working directory drifts between calls; use absolute paths or `cd` explicitly.
- **Test accounts** (real Supabase, no staging; see memory `reference_test-accounts`): test admin, test owner, test comedian, approved venue "ZZ Claude Test Venue" (Pune). **The 6c script reset the passwords of these three accounts when the saved ones didn't work** (new passwords were random and not stored anywhere); to log in again, set a new password with the service-role client (`sb.auth.admin.updateUserById(id, { password })`) and sign in with the anon client. Credentials are never to be written into the repo.
- **Live test script:** `/private/tmp/claude-501/-Users-jaivardhan-Downloads-Projects-open-mic-tracker/82390f0b-b831-4eb0-bc65-38c539993ffc/scratchpad/t6c.cjs` (session scratchpad; may be gone; not in the repo). It was run from `apps/api` with `node --env-file=.env <script>`; it creates "TEST – 6c" fixtures (2 temporary owner accounts, 5 venues, one show/pool/request) and deletes everything at the end (venues returned to 12, no leftover notices). Earlier scripts live in other session scratchpads; use them only as references for insert shapes.
- **Fixture traps:** a venue inserted `pending` with `is_active = false` is rewritten to `rejected` by the legacy sync trigger, so pending fixtures need `is_active = true`. The 020 gate blocks service-role inserts of shows/pools for a venue that is not approved + active + not suspended, so a fixture venue that needs shows must be inserted approved with `is_active = true`; to keep it off the public list also set `is_hidden = true`. Use a "TEST – " name prefix, never touch the user's own venues, delete what you create. Suspend has real side effects (cancels shows and requests): test it only on your own fixtures, not on the shared test venue unless the user agrees.
- Suspend / unsuspend / hide / approve etc. all go through `runVenueReviewAction` (maps RPC `{success,error}` to 404 not found / 409 wrong state); the owner `venue_notices` table shows only venue name, text and date (no type), so notice text must be self-explanatory.
- Rules that stand: address out of scope everywhere (never select it in new code); no "verified" feature; don't touch comedian features, payments or user management; DB changes additive; never put credentials in files git can see.

## 8. How the next session should start

1. Read `CLAUDE.md`, this file, and `specs/admin-venue-management.md` (especially "Working rules", "Step 6a/6b/6c", "Step 7", "Step 8"). Skim `specs/decisions.md` only if a decision's rationale is needed.
2. Verify against this note: `git status --short`, `git log --oneline -5`, `ls apps/api/src/db/migrations | tail`, and that `027_suspend_owner_notice.sql` and `packages/types/photoHosts.js` exist. **Tell the user about any mismatch** (for example if they have committed 6b/6c since: then the "uncommitted" statements above are out of date).
3. Ask or check whether the user has reviewed the 6c editor in a browser and whether they want anything changed there before Step 7.
4. Write **no code and no plan files**. Post the Step 7 plan in chat and wait for "go".

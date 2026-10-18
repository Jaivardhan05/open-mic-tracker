# Decision log

A permanent record of meaningful decisions on this project: backend, frontend, database and UX. One entry per decision. Updated at the end of every step, alongside the spec update, and shown in the `git diff --stat` check.

## How to read and write an entry

Each entry has: **Date / feature / title**, **Context**, **Options considered** (each with advantages and disadvantages), **Decision**, **Why**, **Trade-offs accepted and deferred**, and **Outcome** (UI and UX decisions only; filled in later if not known yet).

- **Attribution of reasoning.** Where the user stated the reason, it is written as theirs. Where the reasoning came from the plan Claude proposed and the user approved, the entry says "proposed in the plan, approved". Nothing is invented: if a reason was not recorded, the entry says "rationale not recorded".
- **Order.** Part 1 holds new entries in chronological order. Part 2 (backfilled earlier decisions, grouped by area) is added in a separate change.

---

# Part 1: Decisions as they are made (chronological)

## 2026-10-18 · Admin venues, Step 5 · Filter on the server, return counts with the list

**Context.** Page A (`/admin/venues`) needs name search, a status filter and a city filter. The status tiles show counts and double as filters, so the counts must stay correct while filtering.

**Options considered.**
- **A. Server-side filtering; the API returns `{ venues, counts }`.** Advantages: matches the spec's "server-side query params"; counts are always right; scales better than shipping everything. Disadvantages: the response changes from an array to an object, so the one consumer (the hook) must be updated; every filter change is a request.
- **B. API returns all venues; the page filters in the browser.** Advantages: instant filtering, no response change. Disadvantages: contradicts the spec; the browser must re-derive counts; every venue is always downloaded.

**Decision.** A. (The user chose it.)

**Why.** It follows the spec and keeps one place that computes counts. The reasons above are from the plan, approved by the user; the user gave no further rationale.

**Trade-offs accepted / deferred.** One request per filter change (softened by the debounce, see below). The old `GET /api/admin/venues` (used by `/home`) is untouched until step 8.

## 2026-10-18 · Admin venues, Step 5 · Counts follow search and city, ignore the selected status

**Context.** With a search like "Laugh" active, what should the Pending tile show: 1 of the matches, or 1 of all venues?

**Options considered.**
- **Counts follow `q` and `city`, ignore `status`.** Advantages: the tiles are a breakdown of what was searched and still add up to "All"; switching tiles never changes the other tiles. Disadvantages: the tiles are not global totals while a search is active.
- **Global counts, never narrowed.** Advantages: simple, stable. Disadvantages: the tiles disagree with the list below them during a search.
- **Counts follow every filter including `status`.** Advantages: matches the list exactly. Disadvantages: selecting a tile zeroes every other tile, so they stop working as filters.

**Decision.** The first. (The user chose it.)

**Why.** Recorded by the user as the choice only; the advantages above are from the plan, approved.

**Trade-offs accepted / deferred.** During a search the tiles are not global totals. Clearing the search restores them.

**Outcome.** Not yet known (to be judged when the filters are used in the browser).

## 2026-10-18 · Admin venues, Step 5 · City dropdown lists the cities present in the data

**Context.** `venues.city` is free text (default `'Delhi'`). The API already has a fixed `VENUE_CITIES` list (Delhi, Mumbai, Bangalore, Pune) used for owner edits.

**Options considered.**
- **Cities present in the data, returned by the API.** Advantages: no venue can be unreachable because its city isn't in a list (legacy or seed rows may use other spellings). Disadvantages: a city with no venues doesn't appear.
- **`VENUE_CITIES`.** Advantages: stable, matches what owners can pick. Disadvantages: venues with other values can't be filtered to.

**Decision.** Cities present in the data; the list covers **every** venue and is **not narrowed** by the search or other filters, so the dropdown doesn't shift while typing. (The user chose both.)

**Why.** From the plan, approved: no unreachable venues, and a stable control.

**Trade-offs accepted / deferred.** Two spellings of one city appear as two options; the city filter itself is case-insensitive, so `pune` and `Pune` match each other. Data cleanup is not part of this step.

## 2026-10-18 · Admin venues, Step 5 · Debounce search ~250 ms and keep the previous list on screen

**Context.** Filtering is server-side (see above), so typing could send a request per keystroke and a flash of empty or loading state per request.

**Options considered.**
- **Debounce ~250 ms, keep the previous results visible while loading.** Advantages: fewer requests, no flicker. Disadvantages: needs stale-response protection and a visible "busy" cue.
- **Request on every keystroke.** Advantages: simplest. Disadvantages: request storm; out-of-order responses.
- **Search on Enter / button.** Advantages: fewest requests. Disadvantages: slower to use; unlike the existing search in `ManageVenuesSection`.

**Decision.** Debounce ~250 ms and keep the previous list. (The user chose it.) Implementation: the status and city controls apply immediately; the hook numbers its requests and drops any response that arrives after a newer request was sent; while fetching, the results are dimmed and marked `aria-busy`.

**Why.** From the plan, approved. The stale-response guard is needed because without it a slow early response could overwrite a newer one.

**Trade-offs accepted / deferred.** A short delay between typing and results.

**Outcome.** Not yet known (the feel of the delay needs a person using it in the browser).

## 2026-10-18 · Admin venues, Step 5 · Filters live in plain React state, not the URL

**Context.** Should a filtered view survive a refresh or be shareable as a link?

**Options considered.**
- **Plain React state.** Advantages: simplest; nothing in the spec asks for more. Disadvantages: a refresh resets the filters; no shareable filtered link.
- **URL query params.** Advantages: refreshable, shareable, back-button friendly. Disadvantages: more code and more states to keep consistent with the debounce.

**Decision.** Plain state, no URL sync "for now". (The user's wording.)

**Trade-offs accepted / deferred.** Refresh loses the filters. URL sync can be added later without changing the API.

## 2026-10-18 · Admin venues, Step 5 · One shared definition of "display status", no stored column

**Context.** A venue's display status (suspended > hidden-if-approved > review status) is derived from three fields. The status filter and the tile counts need it on the server; rendering needs it on the web. It was only written in `apps/web/src/lib/venueStatus.ts`.

**Options considered.**
- **A stored status column.** Advantages: filter and count in SQL. Disadvantages: a new column that must be kept in sync with three others; a migration; the user said not to add one.
- **Duplicate the rule in the API.** Advantages: no shared-package change. Disadvantages: two copies that can drift, so a tile count and its list could disagree; the user ruled it out.
- **One function in the shared types package, imported by both apps.** Advantages: one rule, no schema change. Disadvantages: the package had only ever exported types, so this adds a runtime export (see the next entry for what that cost).

**Decision.** The shared function in `@repo/types`; the API loads the venues, derives status with it, then filters and counts. `venueStatus.ts` in the web app re-exports it, so no call site changed. (The user decided: no stored column, define the rule in exactly one place, replace the web duplicate if it can be done within Step 5's scope.)

**Why.** The user's reasoning: do not add a stored status column; define the rule once in the shared package.

**Trade-offs accepted / deferred.** Filtering and counting happen in memory after loading every venue (no SQL). Fine at hundreds of rows; if the table grows to many thousands, the filter must move into SQL (and the rule would then exist there too).

## 2026-10-18 · Admin venues, Step 5 · Search by venue name only, as a separate filter from the existing helper

**Context.** The existing `matchesVenueSearch` helper (used by `ManageVenuesSection`) matches name **and address**. Address is out of scope for this whole project (working rule 8).

**Options considered.**
- **Name-only search in the new API filter; leave the old helper alone.** Advantages: respects the no-address rule; no risk to `/home`. Disadvantages: two search implementations until step 8 retires the old one.
- **Reuse `matchesVenueSearch`.** Advantages: one helper. Disadvantages: it searches addresses; the new endpoint doesn't even return them.

**Decision.** Name-only, separate. (The user acknowledged it: "Leave address search untouched.")

**Why.** Spec rule 8 and the user's instruction.

**Outcome.** Verified live: a query equal to a venue's address text matches nothing.

## 2026-10-18 · Admin venues, Step 5 · Over-long search text is truncated to 100 characters, not rejected

**Context.** The search text needs a length cap. (The user's first instruction was to escape wildcard characters and cap at 100.)

**Options considered.**
- **Truncate to 100 on the server.** Advantages: never an error for the user; matches the input's `maxLength`. Disadvantages: a hand-built request is silently shortened.
- **Return 400.** Advantages: explicit. Disadvantages: an error for something the UI already prevents.

**Decision.** Truncate. (The user chose it.) The server also trims the text and ignores a repeated `q` parameter.

**Why / consequence for escaping.** Matching is a JavaScript substring test on already-loaded rows, not a SQL `ILIKE`, so `%` and `_` are ordinary characters and **need no escaping**. This was verified live (`%` finds only a name containing `%`; `%%` finds nothing). The escaping the user asked for would only matter if the filter moves into SQL later.

## 2026-10-18 · Admin venues, Step 5 · Keep the "Needs your attention" / "Everything else" split while filtering

**Context.** Page A splits pending venues into a review queue and the rest. With a search active, should that structure stay?

**Options considered.**
- **Keep the split; add a separate "no matches" state.** Advantages: the page keeps its shape; the review queue stays recognisable. Disadvantages: more empty-state copy.
- **Switch to one flat list while searching.** Advantages: simpler. Disadvantages: changes the page's structure depending on the box contents.

**Decision.** Keep the split, with a separate empty state for "no matches" (a message and a Clear filters button), plus search-aware copy in each section ("No pending venues match.", "No other venues match."). (The user chose it.) After approve or reject, the refetch uses the current filters.

**Outcome.** Not yet known; not yet seen in a browser. (The user had already reviewed Page A visually before this step.)

## 2026-10-18 · Admin venues, Step 5 · Sharing a runtime function through `@repo/types`: what failed and what fixed it

**Context.** The shared status function (above) made `@repo/types` export runtime code for the first time. The package is `main: ./index.ts` with no build step and no `"type"` field, Next had no `transpilePackages`, and the API is an ES module run with `tsx`.

**What was tried, in order.**
1. **`apps/web/next.config.js`: `transpilePackages: ['@repo/types']`.** Approved up front by the user as a necessary change; `next build` passes. (The file is `next.config.js`, not `.mjs` as first written.)
2. **A new `packages/types/venueStatus.ts`, re-exported from `index.ts`** (`export { deriveDisplayStatus } from './venueStatus'`). `next build` and the typecheck passed, but **the API crashed at startup**: `The requested module '@repo/types' does not provide an export named 'deriveDisplayStatus'`. Because the package has no `"type": "module"`, Node treats it as CommonJS, and a named import of a CommonJS module only works for exports Node can detect statically; the re-export was not detected.
3. **Defining the function directly in `index.ts`** (deleting `venueStatus.ts`). Same crash. A `tsx -e` check seemed to work only because `-e` runs as CommonJS, which misled the diagnosis for a moment.
4. **`"type": "module"` in `packages/types/package.json`.** First proven on a throwaway copy outside the repo (it worked; the same copy as `commonjs` failed), then applied after the user approved it. Before applying, every importer was checked: `apps/api` (3 files) and `apps/web` (about 35 files), almost all `import type`; the only runtime imports are the two new ones; no `require()`, no `scripts/` directory, and `packages/ui` doesn't import the package. After applying: `next build`, `check-types` for web and ui, ESLint and the API's ad hoc `tsc` all pass, and the API starts.

**Options considered at the point of failure.**
- **`"type": "module"` on the package.** Advantages: one line; keeps one shared rule; works for web and API. Disadvantages: a config change outside Step 5's original file scope (approved); affects how every importer resolves the package.
- **Duplicate the rule in the API.** Advantages: no package change. Disadvantages: two copies that can drift; the user had ruled it out.
- **Drop the shared function.** Advantages: no config change. Disadvantages: same duplication problem; the user had ruled it out.

**Decision.** `"type": "module"`, with the function defined directly in `index.ts`. (The user approved it and required the importer check first.) The duplicate and drop options were rejected for the reason above.

**Why.** The user's rule was one definition, imported by both apps. This is the smallest change that keeps it.

**Trade-offs accepted / deferred.** `next build` passing did **not** prove the API would start, so adding any further runtime export to this package now needs both checks. The `index.ts` comment and `specs/admin-venue-management.md` (environment notes) say so.

## 2026-10-18 · Admin venues, Step 5 · Known deployment trap: the API cannot run from a plain `node dist/index.js`

**Context.** A consequence of the entry above, logged so it isn't a surprise later.

**The trap.** `apps/api` has no `tsconfig.json`, and its `build` script (`tsc`) does not produce a working `dist`. If the API is ever run as plain `node dist/index.js`, the runtime import of `@repo/types` (a `.ts` file) will fail. The same underlying issue also affected `tsx` in development (CommonJS-versus-ESM named imports), which is what `"type": "module"` fixed; **in dev the API works, in a plain-`node` production run it would still not**.

**Options considered (none chosen yet).**
- **Give the API a real build** (a tsconfig plus compiling or bundling `@repo/types` into the output). Advantages: the proper fix. Disadvantages: new tooling and a deployment decision not yet made.
- **Run the API under `tsx` in production.** Advantages: no build. Disadvantages: unusual for production; startup cost.
- **Stop importing runtime code from `@repo/types` in the API.** Advantages: removes the trap. Disadvantages: brings the duplication back.

**Decision.** Deferred. Documented in the spec (Step 5, "Known deployment trap") so whoever deploys the API sees it first.

**Trade-offs accepted / deferred.** The trap stays until a deployment approach is chosen.

## 2026-10-18 · Admin venues, Step 5 · Testing with disposable "TEST – " venues

**Context.** Only 12 venues existed (9 hidden, 2 approved, 1 pending), so most states and a second city couldn't be exercised.

**Options considered.**
- **Create prefixed fixture venues with the service role, then delete them.** Advantages: covers every state, wildcard characters and four cities; leaves nothing behind. Disadvantages: writes to the real database (there is no staging).
- **Test only against the existing 12.** Advantages: no writes. Disadvantages: most states untested.

**Decision.** Nine venues named "TEST – ...", all ownerless and none public (pending, changes requested, rejected, or approved-but-hidden), so they never appeared on the public list. The user's venues and the earlier test venue were not touched. All nine were deleted by id afterwards and the count was back to 12. (The user allowed this with these conditions.)

**Outcome.** 62 live checks passed. The script is in the session scratchpad, not the repo.

## 2026-10-18 · Admin venues, Step 6 · Split into 6a / 6b / 6c
**Decision.** 6a read-only dossier plus actions; 6b suspend UI; 6c edit mode and photos. **Why.** Keeps each diff reviewable (the user's call). Page A filters stay plain state, so Back from a venue resets them (known limitation).

## 2026-10-18 · Admin venues, Step 6 · Migration 026: hide/unhide record who and when
**Options.** (A) migration with `hidden_at`/`hidden_by` and state-aware functions; (B) API wrappers only, no audit data. **Decision.** A (the user's call): the spec wanted "who/when" and `p_admin_id` on every action. **Trade-off.** Older hidden venues show "time not recorded"; the older `/home` routes now refuse a repeat hide. The owner-protect trigger was extended so the new columns cannot be forged.

## 2026-10-18 · Admin venues, Step 6 · Hide/unhide in every status except suspended
**Decision.** Offered for pending, changes-requested, rejected and approved venues (the hide flag is independent of review state); refused for suspended ones by a read in the route, not in the RPC, so the legacy routes keep their behavior.

## 2026-10-18 · Admin venues, Step 6 · Photo host allowlist (built in 6c), single source of truth
**Decision.** Allow `picsum.photos`, `images.unsplash.com` and our Supabase public storage path only, validated in the API and mirrored in `next/image` `remotePatterns`. **Why.** `next/image` throws on unlisted hosts, which would break public pages. **Known gap.** The owner can probably still write any photo URL directly through PostgREST (the protect trigger omits `photos`); flagged, not changed. One existing venue's photo is on `http://localhost` (not public).

## 2026-10-18 · Admin venues, Step 6 · Admin edit rules and deferrals
**Decision (user's).** Unknown keys on `PATCH` get 400; only changed fields are sent; edits allowed in every status; photos get up/down reorder with the first labelled "Cover" and no previews; unsaved-changes warning covers tab close and the page's own links only. **Deferred.** Notifying the owner when an admin edits a live venue.

## 2026-10-18 · Admin venues, Step 6b · Suspend notifies the owner (migration 027)
**Options.** (A) banner only; (B) also a `venue_notices` row. **Decision.** B (the user's call: "the notice is important"). `admin_suspend_venue` inserts "Your venue was suspended: <reason>" in the same transaction, so a failed notice rolls the suspend back. The text says what happened itself because Notices shows no type. Unsuspend sends none.

## 2026-10-18 · Admin venues, Step 6b · Suspend confirmation is typing "Suspend"
**Decision (user's).** One modal with the venue name, live counts and warnings, a required reason, and a typed "Suspend" (trimmed, case-ignored) that enables the final button. Not the venue name. Accepted: the reason is erased on unsuspend (no audit log yet); legacy bookings are not cancelled; one venue per owner.

## 2026-10-18 · Admin venues, Step 6c · One validator and length caps for owners and admins
**Decision (user's).** Owner and admin venue edits share `validateVenueFields`; caps added: links 2048, email 254, phone 32. Existing data was checked first (longest link 66, nothing near the others), so no one is locked out. **Trade-off.** The owner path is now slightly stricter than before. Photos are accepted only on the admin path.

## 2026-10-18 · Admin venues, Step 6c · Photo rules in one plain-ESM file
**Decision.** `packages/types/photoHosts.js` (+ `.d.ts`) holds the host list and `validatePhotoUrls`; the API, the editor and `next.config.js` (`remotePatterns`) all import it. Verified to import under plain Node, `next build` and the running API. A future owner flow can call the same validator.

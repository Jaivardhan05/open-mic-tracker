# Venue Producer Dashboard — Spec

**Status:** Ready for implementation
**Scope:** venue_producer dashboard — calendar, spot creation, request management, cancellation
**Out of scope:** payments, recurring spots, editing spot details post-creation, comedian-side calendar redesign (beyond the reminders-window status update described in §6)

---

## 1. Overview

Venue producers currently have a stubbed dashboard. This spec adds:

1. A calendar showing the venue producer's own spots.
2. An "Add a new Spot" flow.
3. A request-management panel: accept requests, automatic waitlisting, promote from waitlist, cancel a spot.
4. Comedian-side surfacing of accept/waitlist/cancel status in their existing reminders window.

This replaces the old "book instantly" assumption from the original requirements doc. Booking is now a **request → accept** flow. No reject action exists — overflow is handled automatically via waitlist.

---

## 2. Data Model

### 2.1 `spots` (new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| venue_producer_id | uuid, FK → users | owner of the spot |
| date | date | |
| start_time | time | |
| end_time | time | |
| spot_type | enum: `busking`, `non_busking` | |
| total_spots | integer | set at creation, immutable |
| available_spots | integer | starts = total_spots; decremented on accept, incremented on comedian-cancel |
| price | decimal, nullable | `null` or `0` = Free |
| is_cancelled | boolean | default `false` |
| cancellation_message | text, nullable | defaults to `"Spot canceled by venue"` if venue owner leaves it blank |
| created_at | timestamp | |

### 2.2 `spot_requests` (new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| spot_id | uuid, FK → spots | |
| comedian_id | uuid, FK → users | |
| status | enum: `pending`, `accepted`, `waitlisted`, `cancelled_by_comedian`, `cancelled_by_venue` | |
| venue_message | text, nullable | attached when venue owner accepts (optional note) |
| requested_at | timestamp | |
| decided_at | timestamp, nullable | set when status moves off `pending`/`waitlisted` |

**Constraint:** one `(spot_id, comedian_id)` pair should be unique for any *active* request (pending/accepted/waitlisted) — a comedian shouldn't be able to submit duplicate requests to the same spot. Not enforced for cancelled rows (history is kept).

---

## 3. State Machinecomedian applies
→ spot_request created as pending

venue owner accepts a pending request
→ that request → accepted
→ spots.available_spots -= 1
→ optional venue_message stored
→ IF available_spots == 0:
all other pending requests on this spot → waitlisted (automatic, no manual reject)

comedian cancels an accepted request
→ request → cancelled_by_comedian
→ spots.available_spots += 1
→ spot becomes eligible for promotion (see below)

venue owner promotes a waitlisted request (only enabled if available_spots > 0)
→ request → accepted
→ spots.available_spots -= 1
→ optional venue_message stored

venue owner cancels the whole spot
→ spots.is_cancelled = true
→ spots.cancellation_message = provided text OR "Spot canceled by venue"
→ ALL spot_requests on this spot (any status) → cancelled_by_venue
→ each cancelled_by_venue request inherits spots.cancellation_message
→ spot can no longer accept new requests, promotions, or be un-cancelled
No reject action exists in this version. No edit-after-creation for spot details (date/time/type/price) — only cancellation.

---

## 4. API Endpoints (`apps/api`)

All routes authenticated; role-guarded to `venue_producer` unless noted. Follow the existing server-side whitelist pattern (no raw client Supabase writes for mutations).

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/spots` | Create a spot (date, start_time, end_time, spot_type, total_spots, price) |
| GET | `/api/spots/mine` | List venue producer's own spots (for calendar) |
| POST | `/api/spots/:id/cancel` | Cancel a spot; body: `{ message?: string }` |
| GET | `/api/spots/:id/requests` | List all requests for a spot, grouped by status |
| POST | `/api/spot-requests` | Comedian applies to a spot; body: `{ spot_id }`. Role-guarded to `comedian`. |
| POST | `/api/spot-requests/:id/accept` | Venue owner accepts a pending or promotes a waitlisted request; body: `{ message?: string }` |
| POST | `/api/spot-requests/:id/cancel` | Comedian cancels their own accepted request. Role-guarded to `comedian`; ownership check required (comedian can only cancel their own request). |
| GET | `/api/spot-requests/mine` | Comedian's own requests across all spots (for reminders window) |

**Security notes:**
- `accept`/`cancel` on spots must verify `venue_producer_id` matches the authenticated user — a venue owner must not be able to act on another venue owner's spot.
- The comedian-cancel endpoint must verify the request belongs to the requesting comedian.
- `available_spots` decrement/increment must happen inside a transaction (mirrors the atomic pattern from the original architecture doc) to avoid race conditions if two accepts happen concurrently.

---

## 5. Venue Producer Dashboard UI

### 5.1 Calendar
- Same layout pattern as the comedian's existing calendar (date-cell based).
- Each cell shows the venue owner's own spots for that date: time + busking/non-busking label.
- Cancelled spots show a visibly distinct (e.g. struck-through or dimmed) state on the calendar, not removed.

### 5.2 "Add a new Spot" button + form
Fields:
- Date
- Start time / End time
- Total spots available (integer)
- Type: Busking / Non-Busking (toggle)
- Price: Free or ₹ amount

On submit → `POST /api/spots`. Form closes and calendar/list refreshes.

### 5.3 Requests panel
Grouped per spot, three sections:
1. **Pending** — each request has an **Accept** action, with an optional short message field.
2. **Accepted** — read-only list of who's confirmed.
3. **Waitlisted** — shown only when relevant; each has a **Promote** action, enabled only once `available_spots > 0` for that spot (i.e. after a cancellation frees a slot).

### 5.4 Cancel Spot action
- Available per spot (from the calendar or the requests panel).
- Opens a confirmation with an optional message textarea.
- On confirm with no message entered → stored message defaults to `"Spot canceled by venue"`.
- No un-cancel action.

---

## 6. Comedian-Side Changes (minimal, scoped)

The comedian's existing reminders window already shows applied spots (currently just venue name, per current behavior). This spec adds status + message to that same existing UI element — **no new comedian-facing screen**:

- `accepted` → shows accepted state, plus venue owner's optional message if present.
- `waitlisted` → shows waitlisted state.
- `cancelled_by_venue` → shows cancellation state + the cancellation message (custom or default `"Spot canceled by venue"`).
- Comedian can trigger `cancel` on their own `accepted` request from this same view.

Explicitly out of scope: redesigning the comedian calendar/reminders window layout itself.

---

## 7. Explicitly Deferred

- Payments (per existing phase plan).
- Editing a spot's date/time/type/price after creation.
- Manual reject action (superseded by auto-waitlist).
- Un-cancelling a spot.
- Push/email/SMS notifications — status changes surface only in-app, in the reminders window.
- Recurring/repeating spot creation.

---

## 8. Implementation Order (suggested)

1. `spots` + `spot_requests` tables + migrations, seeded with mock data.
2. API endpoints, with the transaction-safe accept/promote/cancel logic.
3. Venue producer dashboard: calendar (read from `/spots/mine`), Add Spot form, requests panel.
4. Comedian reminders-window update to surface status + message.
5. Manual end-to-end test: create spot → 2 comedians apply → accept 1 (fills spot) → confirm 2nd auto-waitlists → cancel accepted comedian → confirm promote becomes available → cancel whole spot → confirm both comedians show cancellation state.
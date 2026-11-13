-- Migration: billing foundation. The tables, constraints, guard triggers and
-- row-level security that weekly billing stands on, with billing switched OFF.
-- Apply manually against Supabase after 029b_close_spot_requests_direct_writes.sql.
-- See specs/payments-weekly-billing.md (Step 2, "Migration 030", and the
-- round-2 decisions in its banner).
--
-- This migration has NO behaviour: it creates no bill, no payment, no Razorpay
-- object and no callable function. Every table starts empty except the single
-- billing_settings row, which is seeded with billing_enabled = false. A
-- missing billing_settings table already means "billing off" to the API
-- start-up check (apps/api/src/billing/startup.ts); after this migration the
-- row says it explicitly.
--
-- What this adds:
--   * billing_settings        one row of global defaults and retention settings
--   * venue_billing_settings  per-venue switches (billing, dues policy, ...)
--   * bills, bill_lines       the weekly bill and its charges (snapshots)
--   * billing_payments        one row per payment attempt (Razorpay Payment Link)
--   * billing_webhook_events  every verified webhook, stored before processing
--   * billing_events          the append-only audit trail (fixed columns)
--   * billing_exceptions      owner/admin "allow this comedian despite dues"
--   * notifications           in-app notices (comedian and owner)
--   * bill_number_seq         human bill numbers (B-000123); NOT an invoice number
--
-- Rules enforced by the database itself (guard triggers, ALWAYS ON for every
-- caller including the service role and the SQL editor; unlike the 020 gate
-- there is no "no JWT claims" exemption, so a hand edit cannot alter a sent
-- bill. The accepted limit: a superuser can still DISABLE a trigger by hand):
--   * a bill is created as a draft; identity columns never change; once a bill
--     has been sent its money columns, payment_mode and send fields are frozen;
--   * bill lines are only added to a draft bill; their snapshot fields never
--     change; a removed line stays removed;
--   * a payment attempt can only be opened for a SENT, ONLINE bill of the same
--     comedian and mode, for exactly the bill's amount; its identity and
--     Razorpay ids never change; a finished attempt stays finished;
--   * billing_events (the audit trail) refuses UPDATE and TRUNCATE for everyone
--     and refuses DELETE unless the row belongs to a demo bill;
--   * real bills, their lines and their payments cannot be deleted; only demo
--     rows can (is_demo is set at creation, only for a venue whose name starts
--     with 'TEST – ', and can never be changed). That is what lets test
--     fixtures be cleaned up per CLAUDE.md while real money records cannot;
--   * the billing_settings row cannot be deleted.
--
-- Plus two triggers on EXISTING tables (the only change to them): when an
-- accepted request is cancelled or swapped out, or a show is cancelled, any
-- active bill line that came from it gets source_changed_at and its bill gets
-- needs_review = true (spec, "line flag"). They do nothing while no bill line
-- exists, and they never block or change the original write.
--
-- Access: row-level security is on for every table and ALL privileges are
-- revoked from anon and authenticated, then SELECT alone is granted back on
-- bills, bill_lines, billing_payments and notifications, each with a policy
-- that shows a user only their own rows. The settings, webhook, audit and
-- exception tables have no client access at all. Every write goes through the
-- service role (the API, and the lifecycle functions of later steps). The
-- service role gets SELECT/INSERT/UPDATE/DELETE, never TRUNCATE.
--
-- Money is integer paise everywhere. Column names stay razorpay_* (decided
-- 2026-11-13). Refund statuses and refund event names are not constrained: the
-- refund test is still pending (retry on or after 2026-11-17).
--
-- (CHECKs that need a reason use COALESCE(char_length(...), 0): a NULL reason would
-- otherwise make the CHECK evaluate to NULL, which Postgres treats as passing.)
--
-- Safe to re-run: IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS and an
-- ON CONFLICT seed; a re-run never resets settings an admin has changed. The
-- file ends with a check that aborts the whole migration if RLS, grants or the
-- seed row are wrong.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Type and sequence
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE bill_status_enum AS ENUM (
    'draft', 'sent', 'paid', 'paid_offline', 'waived', 'void', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Gaps are possible (a rolled-back insert still uses a number). A bill number
-- is a support reference, not a gap-free invoice number (open question Q1).
CREATE SEQUENCE IF NOT EXISTS bill_number_seq;

-- ---------------------------------------------------------------------------
-- 2. Settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  billing_enabled boolean NOT NULL DEFAULT false,
  billing_start_date date,
  dues_policy_default text NOT NULL DEFAULT 'lenient'
    CHECK (dues_policy_default IN ('lenient', 'strict')),
  due_days smallint NOT NULL DEFAULT 7 CHECK (due_days BETWEEN 3 AND 14),
  commission_bps integer NOT NULL DEFAULT 0 CHECK (commission_bps BETWEEN 0 AND 10000),
  fee_share_bps integer NOT NULL DEFAULT 270 CHECK (fee_share_bps BETWEEN 0 AND 10000),
  auto_send_after_hours integer NOT NULL DEFAULT 72 CHECK (auto_send_after_hours BETWEEN 1 AND 720),
  -- Step 3 re-points price_to_paise() (029) at this column.
  max_spot_price_paise integer NOT NULL DEFAULT 1000000 CHECK (max_spot_price_paise > 0),
  auto_send_cap_paise integer NOT NULL DEFAULT 1000000 CHECK (auto_send_cap_paise > 0),
  -- Razorpay's own minimum is 100 paise (verified in Step 0); this is our policy above it.
  min_online_amount_paise integer NOT NULL DEFAULT 2000 CHECK (min_online_amount_paise >= 100),
  dispute_pause_days smallint NOT NULL DEFAULT 7 CHECK (dispute_pause_days BETWEEN 1 AND 30),
  reminder_max smallint NOT NULL DEFAULT 5 CHECK (reminder_max BETWEEN 0 AND 20),
  -- Retention is a value, not code (decided 2026-11-12: 6 months). Nothing prunes
  -- before Step 10. Bills, lines and payments have NO retention setting.
  webhook_payload_retention_days integer NOT NULL DEFAULT 180 CHECK (webhook_payload_retention_days >= 1),
  notification_retention_days integer NOT NULL DEFAULT 180 CHECK (notification_retention_days >= 1),
  audit_archive_after_months integer DEFAULT 6 CHECK (audit_archive_after_months IS NULL OR audit_archive_after_months >= 1),
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_billing_settings (
  venue_id uuid PRIMARY KEY REFERENCES venues(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  -- Owner's choice: 'strict' = the switch is on, 'lenient' = off. NULL = inherit
  -- the global default (lenient), so a new venue starts off.
  dues_policy text CHECK (dues_policy IN ('lenient', 'strict')),
  -- Set = locked; the owner sees it read-only.
  dues_policy_admin_override text CHECK (dues_policy_admin_override IN ('lenient', 'strict')),
  auto_send boolean NOT NULL DEFAULT true,
  due_days smallint CHECK (due_days IS NULL OR due_days BETWEEN 3 AND 14),
  commission_bps_override integer CHECK (commission_bps_override IS NULL OR commission_bps_override BETWEEN 0 AND 10000),
  -- Pay button eligibility while Route is not used: an admin switch per venue.
  online_payments_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Bills and lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL UNIQUE
    DEFAULT ('B-' || lpad(nextval('bill_number_seq')::text, 6, '0')),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  venue_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comedian_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  venue_name text NOT NULL,
  comedian_name text NOT NULL,
  week_start date NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  status bill_status_enum NOT NULL DEFAULT 'draft',
  -- 'test' or 'live': which Razorpay mode this bill belongs to (rule B1).
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  amount_due_paise integer NOT NULL DEFAULT 0 CHECK (amount_due_paise >= 0),
  -- Frozen at send (see the guard trigger); zero while a draft.
  commission_bps integer NOT NULL DEFAULT 0 CHECK (commission_bps BETWEEN 0 AND 10000),
  fee_share_bps integer NOT NULL DEFAULT 0 CHECK (fee_share_bps BETWEEN 0 AND 10000),
  commission_paise integer NOT NULL DEFAULT 0 CHECK (commission_paise >= 0),
  fee_share_paise integer NOT NULL DEFAULT 0 CHECK (fee_share_paise >= 0),
  venue_net_paise integer NOT NULL DEFAULT 0 CHECK (venue_net_paise >= 0),
  payment_mode text CHECK (payment_mode IN ('online', 'offline')),
  due_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  auto_send_at timestamptz,
  sent_at timestamptz,
  sent_by uuid REFERENCES users(id) ON DELETE RESTRICT,   -- NULL = the system (auto-send)
  paid_at timestamptz,
  cleared_at timestamptz,
  cleared_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  clear_reason text,
  clear_reference text,
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  void_reason text,
  supersedes_bill_id uuid REFERENCES bills(id) ON DELETE RESTRICT,
  disputed_at timestamptz,
  dispute_reason text,
  dispute_resolved_at timestamptz,
  dispute_outcome text CHECK (dispute_outcome IN ('rejected', 'reissued', 'waived')),
  last_reminded_at timestamptz,
  reminder_count smallint NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  needs_review boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A demo bill must belong to a TEST – venue (the en dash is part of the prefix).
  CONSTRAINT bills_demo_needs_test_venue CHECK (NOT is_demo OR venue_name LIKE 'TEST – %'),
  -- Once sent, the frozen split must add up.
  CONSTRAINT bills_frozen_split_adds_up CHECK (
    sent_at IS NULL
    OR venue_net_paise = amount_due_paise - commission_paise - fee_share_paise
  ),
  CONSTRAINT bills_sent_needs_amount CHECK (sent_at IS NULL OR amount_due_paise > 0),
  CONSTRAINT bills_draft_not_sent CHECK (status <> 'draft' OR sent_at IS NULL),
  CONSTRAINT bills_sent_fields CHECK (
    status NOT IN ('sent', 'paid', 'paid_offline', 'waived', 'refunded')
    OR (sent_at IS NOT NULL AND due_at IS NOT NULL AND payment_mode IS NOT NULL)
  ),
  CONSTRAINT bills_paid_fields CHECK (status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL),
  CONSTRAINT bills_cleared_fields CHECK (
    status NOT IN ('paid_offline', 'waived')
    OR (cleared_at IS NOT NULL AND cleared_by IS NOT NULL AND COALESCE(char_length(btrim(clear_reason)), 0) >= 5)
  ),
  CONSTRAINT bills_void_fields CHECK (
    status <> 'void'
    OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND COALESCE(char_length(btrim(void_reason)), 0) >= 5)
  ),
  CONSTRAINT bills_dispute_reason CHECK (disputed_at IS NULL OR COALESCE(char_length(btrim(dispute_reason)), 0) >= 10)
);

-- One live bill per venue, comedian and week; a void bill frees the slot (the
-- generation function separately refuses to recreate a discarded draft).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_one_live_per_week
  ON bills (venue_id, comedian_id, week_start) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS idx_bills_comedian_status ON bills (comedian_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_owner_status ON bills (venue_owner_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_venue_week ON bills (venue_id, week_start);
CREATE INDEX IF NOT EXISTS idx_bills_sent_due ON bills (due_at) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL REFERENCES spot_requests(id) ON DELETE RESTRICT,
  show_id uuid NOT NULL REFERENCES venue_shows(id) ON DELETE RESTRICT,
  -- Snapshots: every charge names its show, venue, date and spot type (hosting included).
  venue_name text NOT NULL,
  show_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  spot_type spot_type_enum NOT NULL,
  label text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),   -- free spots are 0 lines
  active boolean NOT NULL DEFAULT true,
  removed_at timestamptz,
  removed_by uuid REFERENCES users(id) ON DELETE RESTRICT,   -- NULL = released by the system
  removed_reason text,
  source_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CONSTRAINT bill_lines_removal_fields CHECK (
    active
    OR (removed_at IS NOT NULL
        AND (removed_by IS NULL OR char_length(btrim(COALESCE(removed_reason, ''))) >= 3))
  )
);

-- A request can sit on only one ACTIVE line at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_lines_one_active_per_request
  ON bill_lines (request_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_bill_lines_bill ON bill_lines (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_show ON bill_lines (show_id);

-- ---------------------------------------------------------------------------
-- 4. Payment attempts and webhook events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  comedian_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  -- Sent to Razorpay as reference_id. Razorpay allows at most 40 characters and
  -- refuses a duplicate (both verified in Step 0), which makes it a safe
  -- idempotency key against a retried create.
  reference_id text NOT NULL UNIQUE CHECK (char_length(reference_id) BETWEEN 1 AND 40),
  -- The row is written first, then the link is created: NULL until it exists.
  razorpay_payment_link_id text UNIQUE,
  short_url text,
  expires_at timestamptz NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise >= 100),   -- Razorpay's minimum
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'expired', 'cancelled')),
  razorpay_payment_id text UNIQUE,
  razorpay_order_id text,
  method text,
  captured_amount_paise integer CHECK (captured_amount_paise IS NULL OR captured_amount_paise >= 0),
  fee_paise integer CHECK (fee_paise IS NULL OR fee_paise >= 0),
  tax_paise integer CHECK (tax_paise IS NULL OR tax_paise >= 0),
  captured_at timestamptz,
  reconcile_flag text CHECK (reconcile_flag IN ('bill_not_payable', 'duplicate_payment', 'amount_mismatch')),
  reconcile_resolved_at timestamptz,
  reconcile_resolved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  reconcile_note text,
  -- Refund fields are deliberately loose until the refund test has run.
  refund_id text,
  refund_status text,
  refunded_paise integer NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_payments_captured_fields CHECK (
    status <> 'captured'
    OR (razorpay_payment_id IS NOT NULL AND captured_at IS NOT NULL AND captured_amount_paise IS NOT NULL)
  ),
  CONSTRAINT billing_payments_refund_cap CHECK (
    refunded_paise <= COALESCE(captured_amount_paise, amount_paise)
  )
);

-- One open attempt per bill: the double-click and two-tab guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_one_open_per_bill
  ON billing_payments (bill_id) WHERE status = 'created';
CREATE INDEX IF NOT EXISTS idx_billing_payments_bill ON billing_payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_comedian ON billing_payments (comedian_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_open_expiry
  ON billing_payments (expires_at) WHERE status = 'created';
CREATE INDEX IF NOT EXISTS idx_billing_payments_unresolved_flag
  ON billing_payments (reconcile_flag) WHERE reconcile_flag IS NOT NULL AND reconcile_resolved_at IS NULL;

-- Written only after the signature verified. event_id is X-Razorpay-Event-Id
-- (present and unique on every event, verified in Step 0). Not append-only:
-- the Step 10 job strips old payloads (they hold customer contact details).
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  payload jsonb,
  payload_stripped_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CHECK (payload IS NOT NULL OR payload_stripped_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_status ON billing_webhook_events (status, received_at);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_received ON billing_webhook_events (received_at);

-- ---------------------------------------------------------------------------
-- 5. Audit trail, exceptions, notifications
-- ---------------------------------------------------------------------------

-- Important facts only, in fixed columns (decided 2026-11-12): no free-form
-- metadata, no webhook payloads, no emails, phones or IPs. The ids are plain
-- uuid columns WITHOUT foreign keys so a record always survives; the names and
-- number are snapshots.
CREATE TABLE IF NOT EXISTS billing_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN (
    'payment_captured', 'payment_refunded', 'payment_flagged',
    'bill_cleared_offline', 'bill_waived', 'bill_reopened', 'bill_voided'
  )),
  bill_id uuid,
  bill_number text,
  from_status text,
  to_status text,
  amount_paise integer,
  week_start date,
  comedian_id uuid,
  comedian_name text,
  venue_id uuid,
  venue_name text,
  venue_owner_id uuid,
  actor_id uuid,
  actor_role text CHECK (actor_role IN ('comedian', 'owner', 'admin', 'system', 'razorpay')),
  actor_name text,
  reason text,
  reference text,
  payment_id uuid,
  razorpay_payment_id text,
  method text,
  mode text CHECK (mode IN ('test', 'live')),
  fee_paise integer,
  -- Never supplied by the caller: a trigger copies it from the bill. Only rows
  -- of demo bills can ever be deleted.
  is_demo boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_billing_events_bill ON billing_events (bill_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events (created_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_venue ON billing_events (venue_id, created_at);

CREATE TABLE IF NOT EXISTS billing_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  comedian_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 5),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

-- At most one non-revoked exception per venue and comedian.
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_exceptions_one_live
  ON billing_exceptions (venue_id, comedian_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_exceptions_comedian ON billing_exceptions (comedian_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Notices are not money records, so they go with their user or demo bill.
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE,
  -- Makes the reminder job idempotent: one notice per (user, key).
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Guard functions (trigger functions; no caller can run them directly)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION billing_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION billing_settings_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'The billing_settings row cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION billing_bills_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT OLD.is_demo THEN
      RAISE EXCEPTION 'A real bill cannot be deleted (%).', OLD.bill_number;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'A bill must be created as a draft.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE. Identity never changes, from creation on.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.bill_number IS DISTINCT FROM OLD.bill_number
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
     OR NEW.venue_id IS DISTINCT FROM OLD.venue_id
     OR NEW.venue_owner_id IS DISTINCT FROM OLD.venue_owner_id
     OR NEW.comedian_id IS DISTINCT FROM OLD.comedian_id
     OR NEW.week_start IS DISTINCT FROM OLD.week_start
     OR NEW.venue_name IS DISTINCT FROM OLD.venue_name
     OR NEW.comedian_name IS DISTINCT FROM OLD.comedian_name
     OR NEW.generated_at IS DISTINCT FROM OLD.generated_at
     OR NEW.supersedes_bill_id IS DISTINCT FROM OLD.supersedes_bill_id THEN
    RAISE EXCEPTION 'The identity of a bill (number, venue, comedian, week, names, mode, demo flag) cannot change (%).', OLD.bill_number;
  END IF;

  -- Once a bill has been sent, its money and send fields are frozen for good.
  -- (due_at is not frozen: an admin reopen restarts the due date.)
  IF OLD.sent_at IS NOT NULL THEN
    IF NEW.amount_due_paise IS DISTINCT FROM OLD.amount_due_paise
       OR NEW.commission_bps IS DISTINCT FROM OLD.commission_bps
       OR NEW.fee_share_bps IS DISTINCT FROM OLD.fee_share_bps
       OR NEW.commission_paise IS DISTINCT FROM OLD.commission_paise
       OR NEW.fee_share_paise IS DISTINCT FROM OLD.fee_share_paise
       OR NEW.venue_net_paise IS DISTINCT FROM OLD.venue_net_paise
       OR NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
       OR NEW.sent_by IS DISTINCT FROM OLD.sent_by THEN
      RAISE EXCEPTION 'The money fields of a sent bill are frozen and cannot change (%).', OLD.bill_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION billing_lines_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status bill_status_enum;
  v_demo boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM bills WHERE id = NEW.bill_id;
    IF v_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Lines can only be added to a draft bill.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT is_demo INTO v_demo FROM bills WHERE id = OLD.bill_id;
    IF NOT COALESCE(v_demo, false) THEN
      RAISE EXCEPTION 'A line of a real bill cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: only active, the removal fields and source_changed_at may change.
  IF (NEW.id, NEW.bill_id, NEW.request_id, NEW.show_id, NEW.venue_name, NEW.show_date,
      NEW.start_time, NEW.end_time, NEW.spot_type, NEW.label, NEW.amount_paise, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.bill_id, OLD.request_id, OLD.show_id, OLD.venue_name, OLD.show_date,
      OLD.start_time, OLD.end_time, OLD.spot_type, OLD.label, OLD.amount_paise, OLD.created_at) THEN
    RAISE EXCEPTION 'The snapshot fields of a bill line cannot change.';
  END IF;

  IF NOT OLD.active AND NEW.active THEN
    RAISE EXCEPTION 'A removed bill line cannot be re-activated.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION billing_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b bills%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO b FROM bills WHERE id = NEW.bill_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A payment attempt needs an existing bill.';
    END IF;
    IF b.status <> 'sent' OR b.payment_mode IS DISTINCT FROM 'online' THEN
      RAISE EXCEPTION 'A payment attempt can only be opened for a sent online bill.';
    END IF;
    IF NEW.comedian_id <> b.comedian_id OR NEW.mode <> b.mode OR NEW.amount_paise <> b.amount_due_paise THEN
      RAISE EXCEPTION 'A payment attempt must match its bill (comedian, mode and exact amount).';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT * INTO b FROM bills WHERE id = OLD.bill_id;
    IF NOT FOUND OR NOT b.is_demo THEN
      RAISE EXCEPTION 'A payment record of a real bill cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.bill_id IS DISTINCT FROM OLD.bill_id
     OR NEW.comedian_id IS DISTINCT FROM OLD.comedian_id
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
     OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'The identity of a payment attempt (bill, comedian, mode, reference, amount, expiry) cannot change.';
  END IF;

  IF OLD.razorpay_payment_link_id IS NOT NULL
     AND NEW.razorpay_payment_link_id IS DISTINCT FROM OLD.razorpay_payment_link_id THEN
    RAISE EXCEPTION 'The Razorpay link id of an attempt cannot change once set.';
  END IF;
  IF OLD.razorpay_payment_id IS NOT NULL
     AND NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id THEN
    RAISE EXCEPTION 'The Razorpay payment id of an attempt cannot change once set.';
  END IF;

  IF OLD.status <> 'created' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A finished payment attempt (%) cannot change status.', OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

-- The audit row's demo flag always comes from its bill, never from the caller.
CREATE OR REPLACE FUNCTION billing_events_set_demo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_demo := COALESCE((SELECT b.is_demo FROM bills b WHERE b.id = NEW.bill_id), false);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION billing_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;   -- only rows of demo bills (TEST – fixtures) can be removed
  END IF;
  RAISE EXCEPTION 'The billing audit trail is append-only.';
END;
$$;

CREATE OR REPLACE FUNCTION billing_events_no_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'The billing audit trail cannot be truncated.';
END;
$$;

-- When an accepted request is cancelled or swapped out, or a show is cancelled
-- after a bill line was created from it, mark the line and its bill for
-- review. SECURITY DEFINER because the writer may be any role; it only ever
-- touches bill_lines and bills.needs_review, and does nothing without lines.
CREATE OR REPLACE FUNCTION billing_flag_line_source_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'spot_requests' THEN
    WITH hit AS (
      UPDATE bill_lines
         SET source_changed_at = now()
       WHERE request_id = NEW.id AND active AND source_changed_at IS NULL
      RETURNING bill_id
    )
    UPDATE bills SET needs_review = true
     WHERE id IN (SELECT bill_id FROM hit) AND NOT needs_review;
  ELSIF TG_TABLE_NAME = 'venue_shows' THEN
    WITH hit AS (
      UPDATE bill_lines
         SET source_changed_at = now()
       WHERE show_id = NEW.id AND active AND source_changed_at IS NULL
      RETURNING bill_id
    )
    UPDATE bills SET needs_review = true
     WHERE id IN (SELECT bill_id FROM hit) AND NOT needs_review;
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_billing_settings_touch ON billing_settings;
CREATE TRIGGER trg_billing_settings_touch BEFORE UPDATE ON billing_settings
  FOR EACH ROW EXECUTE FUNCTION billing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_billing_settings_no_delete ON billing_settings;
CREATE TRIGGER trg_billing_settings_no_delete BEFORE DELETE ON billing_settings
  FOR EACH ROW EXECUTE FUNCTION billing_settings_no_delete();

DROP TRIGGER IF EXISTS trg_venue_billing_settings_touch ON venue_billing_settings;
CREATE TRIGGER trg_venue_billing_settings_touch BEFORE UPDATE ON venue_billing_settings
  FOR EACH ROW EXECUTE FUNCTION billing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bills_guard ON bills;
CREATE TRIGGER trg_bills_guard BEFORE INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION billing_bills_guard();

DROP TRIGGER IF EXISTS trg_bills_touch ON bills;
CREATE TRIGGER trg_bills_touch BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION billing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bill_lines_guard ON bill_lines;
CREATE TRIGGER trg_bill_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON bill_lines
  FOR EACH ROW EXECUTE FUNCTION billing_lines_guard();

DROP TRIGGER IF EXISTS trg_billing_payments_guard ON billing_payments;
CREATE TRIGGER trg_billing_payments_guard BEFORE INSERT OR UPDATE OR DELETE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION billing_payments_guard();

DROP TRIGGER IF EXISTS trg_billing_payments_touch ON billing_payments;
CREATE TRIGGER trg_billing_payments_touch BEFORE UPDATE ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION billing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_billing_events_set_demo ON billing_events;
CREATE TRIGGER trg_billing_events_set_demo BEFORE INSERT ON billing_events
  FOR EACH ROW EXECUTE FUNCTION billing_events_set_demo();

DROP TRIGGER IF EXISTS trg_billing_events_append_only ON billing_events;
CREATE TRIGGER trg_billing_events_append_only BEFORE UPDATE OR DELETE ON billing_events
  FOR EACH ROW EXECUTE FUNCTION billing_events_append_only();

DROP TRIGGER IF EXISTS trg_billing_events_no_truncate ON billing_events;
CREATE TRIGGER trg_billing_events_no_truncate BEFORE TRUNCATE ON billing_events
  FOR EACH STATEMENT EXECUTE FUNCTION billing_events_no_truncate();

-- The only two triggers on existing tables (see the header).
DROP TRIGGER IF EXISTS trg_spot_requests_flag_billed_line ON spot_requests;
CREATE TRIGGER trg_spot_requests_flag_billed_line
  AFTER UPDATE OF status ON spot_requests
  FOR EACH ROW
  WHEN (OLD.status = 'accepted' AND NEW.status IS DISTINCT FROM 'accepted')
  EXECUTE FUNCTION billing_flag_line_source_changed();

DROP TRIGGER IF EXISTS trg_venue_shows_flag_billed_line ON venue_shows;
CREATE TRIGGER trg_venue_shows_flag_billed_line
  AFTER UPDATE OF is_cancelled ON venue_shows
  FOR EACH ROW
  WHEN (NEW.is_cancelled AND NOT OLD.is_cancelled)
  EXECUTE FUNCTION billing_flag_line_source_changed();

-- ---------------------------------------------------------------------------
-- 8. Row-level security, policies and grants
-- ---------------------------------------------------------------------------

ALTER TABLE billing_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_billing_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines              ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_exceptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;

-- Supabase grants new tables to anon and authenticated by default; take it all back.
REVOKE ALL ON billing_settings, venue_billing_settings, bills, bill_lines, billing_payments,
              billing_webhook_events, billing_events, billing_exceptions, notifications
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE bill_number_seq, billing_events_id_seq, billing_webhook_events_id_seq
  FROM PUBLIC, anon, authenticated;

-- Read-only client access, each limited by a policy to the caller's own rows.
GRANT SELECT ON bills, bill_lines, billing_payments, notifications TO authenticated;

DROP POLICY IF EXISTS bills_comedian_read_own ON bills;
CREATE POLICY bills_comedian_read_own ON bills FOR SELECT TO authenticated
  USING (comedian_id = auth.uid() AND status <> 'draft');

DROP POLICY IF EXISTS bills_owner_read_own ON bills;
CREATE POLICY bills_owner_read_own ON bills FOR SELECT TO authenticated
  USING (venue_owner_id = auth.uid());

DROP POLICY IF EXISTS bill_lines_read_own ON bill_lines;
CREATE POLICY bill_lines_read_own ON bill_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bills b
    WHERE b.id = bill_lines.bill_id
      AND (b.venue_owner_id = auth.uid()
           OR (b.comedian_id = auth.uid() AND b.status <> 'draft' AND bill_lines.active))
  ));

DROP POLICY IF EXISTS billing_payments_read_own ON billing_payments;
CREATE POLICY billing_payments_read_own ON billing_payments FOR SELECT TO authenticated
  USING (
    comedian_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bills b WHERE b.id = billing_payments.bill_id AND b.venue_owner_id = auth.uid())
  );

DROP POLICY IF EXISTS notifications_read_own ON notifications;
CREATE POLICY notifications_read_own ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The settings, webhook, audit and exception tables get NO policy: no client access.

-- The service role (the API) reads and writes everything but can never TRUNCATE.
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_settings, venue_billing_settings, bills, bill_lines,
      billing_payments, billing_webhook_events, billing_events, billing_exceptions, notifications
  TO service_role;
REVOKE TRUNCATE ON billing_settings, venue_billing_settings, bills, bill_lines, billing_payments,
      billing_webhook_events, billing_events, billing_exceptions, notifications
  FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE bill_number_seq, billing_events_id_seq, billing_webhook_events_id_seq
  TO service_role;

-- Every function here is a trigger function: nobody calls it directly, so it
-- is closed to anon and authenticated and open to service_role only (CLAUDE.md rule).
REVOKE ALL ON FUNCTION billing_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_settings_no_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_bills_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_lines_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_payments_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_events_set_demo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_events_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_events_no_truncate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION billing_flag_line_source_changed() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION billing_touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION billing_settings_no_delete() TO service_role;
GRANT EXECUTE ON FUNCTION billing_bills_guard() TO service_role;
GRANT EXECUTE ON FUNCTION billing_lines_guard() TO service_role;
GRANT EXECUTE ON FUNCTION billing_payments_guard() TO service_role;
GRANT EXECUTE ON FUNCTION billing_events_set_demo() TO service_role;
GRANT EXECUTE ON FUNCTION billing_events_append_only() TO service_role;
GRANT EXECUTE ON FUNCTION billing_events_no_truncate() TO service_role;
GRANT EXECUTE ON FUNCTION billing_flag_line_source_changed() TO service_role;

-- ---------------------------------------------------------------------------
-- 9. Seed: the single settings row, billing OFF. A re-run changes nothing.
-- ---------------------------------------------------------------------------

INSERT INTO billing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. Abort the whole migration if access or the seed is wrong
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbls text[] := ARRAY[
    'billing_settings', 'venue_billing_settings', 'bills', 'bill_lines', 'billing_payments',
    'billing_webhook_events', 'billing_events', 'billing_exceptions', 'notifications'
  ];
  client_readable text[] := ARRAY['bills', 'bill_lines', 'billing_payments', 'notifications'];
  seqs text[] := ARRAY['bill_number_seq', 'billing_events_id_seq', 'billing_webhook_events_id_seq'];
  fns regprocedure[] := ARRAY[
    'billing_touch_updated_at()', 'billing_settings_no_delete()', 'billing_bills_guard()',
    'billing_lines_guard()', 'billing_payments_guard()', 'billing_events_set_demo()',
    'billing_events_append_only()', 'billing_events_no_truncate()', 'billing_flag_line_source_changed()'
  ]::regprocedure[];
  t text;
  r text;
  p text;
  f regprocedure;
  bad text := '';
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      bad := bad || ' [rls off: ' || t || ']';
    END IF;

    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(r, 'public.' || t, p) THEN
          bad := bad || ' [' || r || ' has ' || p || ' on ' || t || ']';
        END IF;
      END LOOP;
    END LOOP;

    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN
      bad := bad || ' [anon can read ' || t || ']';
    END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'SELECT') <> (t = ANY (client_readable)) THEN
      bad := bad || ' [authenticated read access is wrong on ' || t || ']';
    END IF;

    IF NOT (has_table_privilege('service_role', 'public.' || t, 'SELECT')
            AND has_table_privilege('service_role', 'public.' || t, 'INSERT')
            AND has_table_privilege('service_role', 'public.' || t, 'UPDATE')
            AND has_table_privilege('service_role', 'public.' || t, 'DELETE')) THEN
      bad := bad || ' [service_role lacks access to ' || t || ']';
    END IF;
    IF has_table_privilege('service_role', 'public.' || t, 'TRUNCATE') THEN
      bad := bad || ' [service_role can TRUNCATE ' || t || ']';
    END IF;
  END LOOP;

  FOREACH t IN ARRAY seqs LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_sequence_privilege(r, 'public.' || t, 'USAGE')
         OR has_sequence_privilege(r, 'public.' || t, 'SELECT')
         OR has_sequence_privilege(r, 'public.' || t, 'UPDATE') THEN
        bad := bad || ' [' || r || ' can use sequence ' || t || ']';
      END IF;
    END LOOP;
  END LOOP;

  FOREACH f IN ARRAY fns LOOP
    IF has_function_privilege('anon', f, 'EXECUTE')
       OR has_function_privilege('authenticated', f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      bad := bad || ' [function grants wrong: ' || f::text || ']';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM billing_settings) <> 1 THEN
    bad := bad || ' [billing_settings must hold exactly one row]';
  END IF;

  IF bad <> '' THEN
    RAISE EXCEPTION 'Billing foundation access is wrong:%', bad;
  END IF;
END;
$$;

COMMIT;

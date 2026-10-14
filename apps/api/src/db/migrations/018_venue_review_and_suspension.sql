-- Migration: venue review workflow (pending / approved / changes_requested /
-- rejected) and suspension state, plus the admin/owner RPCs that move a venue
-- between them. Apply manually against Supabase after 017b.
-- See specs/admin-venue-management.md.
--
-- Additive and backward compatible:
--   * venues.admin_approved, is_active, is_hidden and hidden_reason keep their
--     meaning. admin_approved is kept equal to (review_status = 'approved') so
--     every existing filter on it keeps working.
--   * Existing rows are backfilled: approved stays approved; unapproved +
--     is_active=false (the old "reject") becomes rejected (no reason recorded);
--     everything else is pending.
--   * Suspension is a separate flag (is_suspended); its cancel-everything RPC
--     ships in migration 021.
-- The backfill UPDATE fires the existing updated_at trigger (if any), so
-- venues.updated_at moves to the migration time for every row.

BEGIN;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE venues
SET review_status = CASE
      WHEN admin_approved THEN 'approved'
      WHEN NOT is_active THEN 'rejected'
      ELSE 'pending'
    END,
    submitted_at = created_at;

-- Invariant: admin_approved is exactly "review_status is approved".
ALTER TABLE venues
  ADD CONSTRAINT venues_approved_matches_review_status
  CHECK ((review_status = 'approved') = admin_approved);

CREATE INDEX IF NOT EXISTS idx_venues_review_status ON venues(review_status);
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Keeps review_status in step when something writes the legacy columns
-- directly (seed.sql, manual edits in the SQL editor). Does nothing when the
-- caller sets review_status itself, as the RPCs below do.
CREATE OR REPLACE FUNCTION venues_sync_review_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status = 'pending' THEN
      IF NEW.admin_approved THEN
        NEW.review_status := 'approved';
      ELSIF NOT NEW.is_active THEN
        NEW.review_status := 'rejected';
      END IF;
    END IF;
  ELSIF NEW.review_status IS NOT DISTINCT FROM OLD.review_status
    AND (NEW.admin_approved IS DISTINCT FROM OLD.admin_approved
         OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    NEW.review_status := CASE
      WHEN NEW.admin_approved THEN 'approved'
      WHEN NOT NEW.is_active THEN 'rejected'
      ELSE 'pending'
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Blocks a venue owner (or anon) from writing moderation columns straight
-- through PostgREST with their own JWT. rls.sql's venues_owner_update_own
-- policy only checks ownership, so without this an owner could set
-- admin_approved / is_hidden / review_status on their own venue. The API's
-- service-role client and the SQL editor (no JWT role claim) are unaffected.
CREATE OR REPLACE FUNCTION venues_protect_moderation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );

  IF v_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'pending'
       OR NEW.is_suspended OR NEW.is_hidden
       OR NEW.review_reason IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL
       OR NEW.suspension_reason IS NOT NULL OR NEW.suspended_at IS NOT NULL OR NEW.suspended_by IS NOT NULL
       OR NEW.hidden_reason IS NOT NULL THEN
      RAISE EXCEPTION 'moderation fields cannot be set on insert' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.owner_id, NEW.admin_approved, NEW.verified, NEW.is_active,
      NEW.is_hidden, NEW.hidden_reason,
      NEW.review_status, NEW.review_reason, NEW.reviewed_at, NEW.reviewed_by, NEW.submitted_at,
      NEW.is_suspended, NEW.suspension_reason, NEW.suspended_at, NEW.suspended_by)
     IS DISTINCT FROM
     (OLD.owner_id, OLD.admin_approved, OLD.verified, OLD.is_active,
      OLD.is_hidden, OLD.hidden_reason,
      OLD.review_status, OLD.review_reason, OLD.reviewed_at, OLD.reviewed_by, OLD.submitted_at,
      OLD.is_suspended, OLD.suspension_reason, OLD.suspended_at, OLD.suspended_by) THEN
    RAISE EXCEPTION 'moderation fields cannot be changed by the venue owner' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger names are ordered so the protect check sees what the client sent,
-- before the sync trigger may rewrite review_status.
CREATE TRIGGER venues_1_protect_moderation
  BEFORE INSERT OR UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_protect_moderation();

CREATE TRIGGER venues_2_sync_review_status
  BEFORE INSERT OR UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_sync_review_status();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Can this producer create/edit spots and take requests? Approved, active and
-- not suspended. Hidden does NOT block (hide only removes the venue from
-- public listings). No venue row means no.
CREATE OR REPLACE FUNCTION venue_can_operate(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM venues
    WHERE owner_id = p_owner_id
      AND admin_approved = true
      AND is_active = true
      AND is_suspended = false
  );
$$;

-- Is this venue visible on public comedian-facing surfaces?
CREATE OR REPLACE FUNCTION venue_is_public(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM venues
    WHERE id = p_venue_id
      AND admin_approved = true
      AND is_active = true
      AND is_hidden = false
      AND is_suspended = false
  );
$$;

-- ---------------------------------------------------------------------------
-- Review RPCs (service role only; the API authorizes the admin first)
-- ---------------------------------------------------------------------------

-- Replaces the originals from functions.sql. The old signatures are dropped
-- first: leaving both would make rpc('admin_approve_venue', { p_venue_id })
-- ambiguous. Calls that pass only p_venue_id (and p_reason) still resolve to
-- the new ones through the defaulted p_admin_id.
DROP FUNCTION IF EXISTS admin_approve_venue(uuid);
DROP FUNCTION IF EXISTS admin_reject_venue(uuid, text);

-- pending | changes_requested -> approved
CREATE OR REPLACE FUNCTION admin_approve_venue(
  p_venue_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_status text;
BEGIN
  UPDATE venues
  SET review_status = 'approved',
      admin_approved = true,
      verified = true,
      review_reason = NULL,
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      updated_at = now()
  WHERE id = p_venue_id
    AND review_status IN ('pending', 'changes_requested')
  RETURNING * INTO v_venue;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'venue_id', v_venue.id,
      'venue_name', v_venue.name,
      'owner_id', v_venue.owner_id
    );
  END IF;

  SELECT review_status INTO v_status FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  RETURN json_build_object(
    'success', false,
    'error', 'Only pending or changes-requested venues can be approved (this one is ' || v_status || ')'
  );
END;
$$;

-- pending | changes_requested -> rejected. Keeps is_active = true, so a
-- rejected venue stays visible to admins and its owner. The reason is
-- required by the API; the function tolerates a blank one (the old UI sent
-- none).
CREATE OR REPLACE FUNCTION admin_reject_venue(
  p_venue_id uuid,
  p_reason text DEFAULT '',
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_reason text;
  v_status text;
BEGIN
  v_reason := NULLIF(trim(p_reason), '');

  UPDATE venues
  SET review_status = 'rejected',
      admin_approved = false,
      verified = false,
      review_reason = v_reason,
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      updated_at = now()
  WHERE id = p_venue_id
    AND review_status IN ('pending', 'changes_requested')
  RETURNING * INTO v_venue;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'venue_id', v_venue.id,
      'owner_id', v_venue.owner_id,
      'reason', v_reason
    );
  END IF;

  SELECT review_status INTO v_status FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  RETURN json_build_object(
    'success', false,
    'error', 'Only pending or changes-requested venues can be rejected (this one is ' || v_status || ')'
  );
END;
$$;

-- pending -> changes_requested. The reason is the admin's note to the owner.
CREATE OR REPLACE FUNCTION admin_request_changes(
  p_venue_id uuid,
  p_reason text,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_reason text;
  v_status text;
BEGIN
  v_reason := NULLIF(trim(p_reason), '');
  IF v_reason IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'A reason is required');
  END IF;

  UPDATE venues
  SET review_status = 'changes_requested',
      review_reason = v_reason,
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      updated_at = now()
  WHERE id = p_venue_id
    AND review_status = 'pending'
  RETURNING * INTO v_venue;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'venue_id', v_venue.id, 'owner_id', v_venue.owner_id);
  END IF;

  SELECT review_status INTO v_status FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  RETURN json_build_object(
    'success', false,
    'error', 'Changes can only be requested on pending venues (this one is ' || v_status || ')'
  );
END;
$$;

-- rejected -> pending. Undoes an accidental rejection. Also sets
-- is_active = true so a legacy "rejected" venue (which had is_active = false)
-- is fully restored. The previous reason is kept for context.
CREATE OR REPLACE FUNCTION admin_reopen_venue(
  p_venue_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_status text;
BEGIN
  UPDATE venues
  SET review_status = 'pending',
      is_active = true,
      submitted_at = now(),
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      updated_at = now()
  WHERE id = p_venue_id
    AND review_status = 'rejected'
  RETURNING * INTO v_venue;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'venue_id', v_venue.id, 'owner_id', v_venue.owner_id);
  END IF;

  SELECT review_status INTO v_status FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  RETURN json_build_object(
    'success', false,
    'error', 'Only rejected venues can be moved back to pending (this one is ' || v_status || ')'
  );
END;
$$;

-- Owner action: changes_requested -> pending. Keeps review_reason so the
-- admin can still see what was asked.
CREATE OR REPLACE FUNCTION owner_resubmit_venue(p_owner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_status text;
BEGIN
  UPDATE venues
  SET review_status = 'pending',
      submitted_at = now(),
      updated_at = now()
  WHERE owner_id = p_owner_id
    AND review_status = 'changes_requested'
  RETURNING * INTO v_venue;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'venue_id', v_venue.id);
  END IF;

  SELECT review_status INTO v_status FROM venues WHERE owner_id = p_owner_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No venue found for this account');
  END IF;
  RETURN json_build_object(
    'success', false,
    'error', 'Only venues with requested changes can be resubmitted (this one is ' || v_status || ')'
  );
END;
$$;

-- Dashboard counts follow the new status: "pending" is review_status =
-- pending (not merely unapproved), and rejected venues no longer count as
-- live venues (they used to drop out via is_active = false).
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total_venues',
      (SELECT COUNT(*) FROM venues
        WHERE is_active = true
        AND review_status <> 'rejected'),
    'pending_approvals',
      (SELECT COUNT(*) FROM venues
        WHERE review_status = 'pending'
        AND is_active = true),
    'total_shows',
      (SELECT COUNT(*) FROM shows
        WHERE is_cancelled = false),
    'total_bookings',
      (SELECT COUNT(*) FROM bookings),
    'confirmed_bookings',
      (SELECT COUNT(*) FROM bookings
        WHERE payment_status = 'confirmed'),
    'total_comedians',
      (SELECT COUNT(*) FROM users
        WHERE role = 'comedian'),
    'total_venue_owners',
      (SELECT COUNT(*) FROM users
        WHERE role = 'venue_producer')
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: new/replaced SECURITY DEFINER functions are callable by the
-- API's service-role client only. (Functions default to EXECUTE for PUBLIC,
-- which would let anyone with the anon key call them over /rest/v1/rpc.)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION admin_approve_venue(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_reject_venue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_request_changes(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_reopen_venue(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION owner_resubmit_venue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION venue_can_operate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION venue_is_public(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_approve_venue(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_reject_venue(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_request_changes(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_reopen_venue(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION owner_resubmit_venue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION venue_can_operate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION venue_is_public(uuid) TO service_role;

COMMIT;

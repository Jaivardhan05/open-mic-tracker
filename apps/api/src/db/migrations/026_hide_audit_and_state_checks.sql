-- Migration: hide/unhide record who and when, and refuse a repeat.
-- Apply manually against Supabase after 025_tighten_public_rls.sql.
-- See specs/admin-venue-management.md (step 6a).
--
-- Why: the older admin_hide_venue / admin_unhide_venue (008) took no admin id,
-- stored no time, and had no state check: hiding an already hidden venue
-- overwrote the reason and sent the owner a second notice, and unhiding a
-- visible venue "succeeded". Page B (/admin/venues/[id]) needs "hidden since,
-- by whom", and every admin action is meant to carry p_admin_id.
--
-- What changes:
--   * venues.hidden_at, venues.hidden_by (FK users, set null on delete).
--     Venues hidden before this migration keep NULL in both: the UI shows
--     "time not recorded". Nothing is backfilled.
--   * admin_hide_venue(uuid, text, uuid DEFAULT NULL): same behaviour as 008
--     (default reason, notice to the owner) plus the two new columns; refuses
--     with "Venue is already hidden" when it already is.
--   * admin_unhide_venue(uuid, uuid DEFAULT NULL): clears the hide fields too;
--     refuses with "Venue is not hidden" when it is not.
--   * The old signatures (uuid,text) and (uuid) are dropped. Existing calls
--     that pass only p_venue_id / p_reason (POST /api/venues/:id/hide|unhide)
--     still resolve through the defaulted p_admin_id. VISIBLE CHANGE for those
--     legacy routes: a repeat hide/unhide now returns { success: false, error }
--     instead of silently succeeding (the routes return the RPC result as is).
--   * venues_protect_moderation (018) is replaced with the same body plus the
--     two new columns, so an owner cannot forge or clear them through
--     PostgREST. Everything else in that function is identical to 018.
--   * New signatures get EXECUTE for service_role only (024's lockdown listed
--     the old signatures, which no longer exist).
--
-- Before applying (read-only, compare with this file; 022b showed the live
-- definition can differ from the repo):
--   SELECT pg_get_functiondef('public.admin_hide_venue(uuid,text)'::regprocedure);
--   SELECT pg_get_functiondef('public.admin_unhide_venue(uuid)'::regprocedure);
--   SELECT pg_get_functiondef('public.venues_protect_moderation()'::regprocedure);
--
-- Atomic: the check at the end aborts the whole migration if a signature,
-- privilege or the trigger body is not as expected.

BEGIN;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Same as 018's venues_protect_moderation, with hidden_at / hidden_by added to
-- the INSERT check and to both sides of the UPDATE comparison.
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
       OR NEW.hidden_reason IS NOT NULL OR NEW.hidden_at IS NOT NULL OR NEW.hidden_by IS NOT NULL THEN
      RAISE EXCEPTION 'moderation fields cannot be set on insert' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.owner_id, NEW.admin_approved, NEW.verified, NEW.is_active,
      NEW.is_hidden, NEW.hidden_reason, NEW.hidden_at, NEW.hidden_by,
      NEW.review_status, NEW.review_reason, NEW.reviewed_at, NEW.reviewed_by, NEW.submitted_at,
      NEW.is_suspended, NEW.suspension_reason, NEW.suspended_at, NEW.suspended_by)
     IS DISTINCT FROM
     (OLD.owner_id, OLD.admin_approved, OLD.verified, OLD.is_active,
      OLD.is_hidden, OLD.hidden_reason, OLD.hidden_at, OLD.hidden_by,
      OLD.review_status, OLD.review_reason, OLD.reviewed_at, OLD.reviewed_by, OLD.submitted_at,
      OLD.is_suspended, OLD.suspension_reason, OLD.suspended_at, OLD.suspended_by) THEN
    RAISE EXCEPTION 'moderation fields cannot be changed by the venue owner' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS admin_hide_venue(uuid, text);
DROP FUNCTION IF EXISTS admin_unhide_venue(uuid);

-- Admin hides a venue: excludes it from comedian-facing listings and notifies
-- the owner why via venue_notices. Allowed in any review state; the API layer
-- (not this function) refuses suspended venues.
CREATE OR REPLACE FUNCTION admin_hide_venue(
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
  v_hidden boolean;
BEGIN
  v_reason := NULLIF(trim(p_reason), '');
  IF v_reason IS NULL THEN
    v_reason := 'venue removed by admin';
  END IF;

  UPDATE venues
  SET is_hidden = true,
      hidden_reason = v_reason,
      hidden_at = now(),
      hidden_by = p_admin_id,
      updated_at = now()
  WHERE id = p_venue_id
    AND NOT is_hidden
  RETURNING * INTO v_venue;

  IF NOT FOUND THEN
    SELECT is_hidden INTO v_hidden FROM venues WHERE id = p_venue_id;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Venue not found');
    END IF;
    RETURN json_build_object('success', false, 'error', 'Venue is already hidden');
  END IF;

  IF v_venue.owner_id IS NOT NULL THEN
    INSERT INTO venue_notices (owner_id, venue_id, venue_name, reason)
    VALUES (v_venue.owner_id, v_venue.id, v_venue.name, v_reason);
  END IF;

  RETURN json_build_object(
    'success', true,
    'venue_id', v_venue.id,
    'owner_id', v_venue.owner_id
  );
END;
$$;

-- Admin reverses a hide. Not punitive, so no notice is sent. p_admin_id is
-- accepted for symmetry (the audit log will use it); nothing stores it today.
CREATE OR REPLACE FUNCTION admin_unhide_venue(
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
  v_hidden boolean;
BEGIN
  UPDATE venues
  SET is_hidden = false,
      hidden_reason = NULL,
      hidden_at = NULL,
      hidden_by = NULL,
      updated_at = now()
  WHERE id = p_venue_id
    AND is_hidden
  RETURNING * INTO v_venue;

  IF NOT FOUND THEN
    SELECT is_hidden INTO v_hidden FROM venues WHERE id = p_venue_id;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Venue not found');
    END IF;
    RETURN json_build_object('success', false, 'error', 'Venue is not hidden');
  END IF;

  RETURN json_build_object('success', true, 'venue_id', v_venue.id);
END;
$$;

REVOKE ALL ON FUNCTION admin_hide_venue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_unhide_venue(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_hide_venue(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_unhide_venue(uuid, uuid) TO service_role;

DO $$
DECLARE
  fns regprocedure[] := ARRAY[
    'admin_hide_venue(uuid,text,uuid)',
    'admin_unhide_venue(uuid,uuid)'
  ]::regprocedure[];
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE')
       OR has_function_privilege('authenticated', fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'GRANTS WRONG for %', fn;
    END IF;
  END LOOP;

  IF to_regprocedure('admin_hide_venue(uuid,text)') IS NOT NULL
     OR to_regprocedure('admin_unhide_venue(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'an old hide/unhide signature is still present';
  END IF;

  IF pg_get_functiondef('public.venues_protect_moderation()'::regprocedure) NOT LIKE '%hidden_at%'
     OR pg_get_functiondef('public.venues_protect_moderation()'::regprocedure) NOT LIKE '%hidden_by%' THEN
    RAISE EXCEPTION 'venues_protect_moderation does not cover hidden_at / hidden_by';
  END IF;
END $$;

COMMIT;

-- Migration: suspending a venue also leaves a notice for its owner
-- ("Notices from Admin"), like hiding does. Apply manually against Supabase
-- after 026_hide_audit_and_state_checks.sql. See specs/admin-venue-management.md
-- (step 6b).
--
-- Only admin_suspend_venue changes: the body is 021's, plus one INSERT into
-- venue_notices inside the same transaction. There is still no EXCEPTION block,
-- so a failed notice rolls back the flag and every cancellation with it.
-- A venue with no owner gets no notice (nobody to read it).
-- admin_unsuspend_venue is untouched and sends no notice.
--
-- The notice text says what happened on its own, because the Notices section
-- shows only the venue name, the text and the date (no type).

BEGIN;

CREATE OR REPLACE FUNCTION admin_suspend_venue(
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
  c_show_message CONSTANT text :=
    'This show was cancelled because the venue is temporarily unavailable.';
  c_request_message CONSTANT text :=
    'This request was cancelled because the venue is temporarily unavailable.';
  v_venue venues%ROWTYPE;
  v_reason text;
  v_show_ids uuid[];
  v_shows integer;
  v_pools integer;
  v_requests integer;
  v_comedians integer;
BEGIN
  v_reason := NULLIF(trim(p_reason), '');

  SELECT * INTO v_venue FROM venues WHERE id = p_venue_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  IF v_venue.is_suspended THEN
    RETURN json_build_object('success', false, 'error', 'Venue is already suspended');
  END IF;
  IF v_venue.review_status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Only approved venues can be suspended');
  END IF;
  IF v_reason IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'A reason is required');
  END IF;

  UPDATE venues
  SET is_suspended = true,
      suspension_reason = v_reason,
      suspended_at = now(),
      suspended_by = p_admin_id
  WHERE id = p_venue_id;

  WITH cancelled AS (
    UPDATE venue_shows
    SET is_cancelled = true,
        cancellation_message = c_show_message
    WHERE venue_producer_id = v_venue.owner_id
      AND NOT is_cancelled
      AND venue_show_is_upcoming(date, end_time)
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_show_ids FROM cancelled;

  v_shows := cardinality(v_show_ids);

  WITH cancelled AS (
    UPDATE spots
    SET is_cancelled = true,
        cancellation_message = c_show_message
    WHERE show_id = ANY (v_show_ids)
      AND NOT is_cancelled
    RETURNING id
  )
  SELECT count(*) INTO v_pools FROM cancelled;

  WITH cancelled AS (
    UPDATE spot_requests
    SET status = 'cancelled_by_venue',
        decided_at = now(),
        venue_message = c_request_message
    WHERE spot_id IN (SELECT id FROM spots WHERE show_id = ANY (v_show_ids))
      AND status IN ('pending', 'accepted', 'waitlisted')
    RETURNING comedian_id
  )
  SELECT count(*), count(DISTINCT comedian_id) INTO v_requests, v_comedians FROM cancelled;

  IF v_venue.owner_id IS NOT NULL THEN
    INSERT INTO venue_notices (owner_id, venue_id, venue_name, reason)
    VALUES (v_venue.owner_id, v_venue.id, v_venue.name, 'Your venue was suspended: ' || v_reason);
  END IF;

  RETURN json_build_object(
    'success', true,
    'venue_id', p_venue_id,
    'shows', v_shows,
    'spots', v_pools,
    'requests', v_requests,
    'comedians', v_comedians
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_suspend_venue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_suspend_venue(uuid, text, uuid) TO service_role;

COMMIT;

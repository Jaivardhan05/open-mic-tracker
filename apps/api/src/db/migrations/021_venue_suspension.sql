-- Migration: suspend / unsuspend a venue, and a preview of what suspending
-- would cancel. Apply manually against Supabase after
-- 020_venue_operating_gate.sql, and BEFORE deploying the API routes that call
-- these functions. See specs/admin-venue-management.md (step 4a).
--
-- Suspension (option B): suspending cancels EVERY upcoming show of the venue's
-- owner, every pool of those shows, and every pending / accepted / waitlisted
-- request on them (-> cancelled_by_venue). Unsuspending clears the flag and
-- restores nothing. Past shows and history are untouched.
--
-- Atomicity: admin_suspend_venue has no EXCEPTION block on purpose. Any error
-- aborts the whole function and rolls back the flag and every cancellation
-- together. It also does not loop over cancel_show(), which swallows errors
-- and returns JSON instead of raising.
--
-- The 019 trigger (trg_spot_requests_track_status) records cancelled_from_status
-- for the request updates below. The 020 gate does not block these writes: it
-- ignores a venue_shows update that leaves the date unchanged, a spots update
-- that leaves date / size / price unchanged without re-activating the pool, and
-- a spot_requests update that is not "-> accepted".
--
-- The comedian-facing texts are fixed and neutral: the admin's reason is only
-- ever shown to the venue owner (venues.suspension_reason).

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared "upcoming" predicate (used by the preview AND the suspend, so the
-- numbers shown to the admin are the numbers acted on). A show is upcoming
-- until its end time has passed, in India time. end_time > start_time is a
-- CHECK on venue_shows, so shows never run past midnight.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION venue_show_is_upcoming(p_date date, p_end_time time)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (p_date + p_end_time) > (now() AT TIME ZONE 'Asia/Kolkata');
$$;

-- ---------------------------------------------------------------------------
-- Preview: what would be cancelled right now.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION venue_suspension_preview(p_venue_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shows integer;
  v_pools integer;
  v_pending integer;
  v_accepted integer;
  v_waitlisted integer;
  v_comedians integer;
BEGIN
  SELECT owner_id INTO v_owner FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;

  SELECT count(*) INTO v_shows
  FROM venue_shows s
  WHERE s.venue_producer_id = v_owner
    AND NOT s.is_cancelled
    AND venue_show_is_upcoming(s.date, s.end_time);

  SELECT count(*) INTO v_pools
  FROM spots p
  JOIN venue_shows s ON s.id = p.show_id
  WHERE s.venue_producer_id = v_owner
    AND NOT s.is_cancelled
    AND venue_show_is_upcoming(s.date, s.end_time)
    AND NOT p.is_cancelled;

  SELECT
    count(*) FILTER (WHERE r.status = 'pending'),
    count(*) FILTER (WHERE r.status = 'accepted'),
    count(*) FILTER (WHERE r.status = 'waitlisted'),
    count(DISTINCT r.comedian_id)
  INTO v_pending, v_accepted, v_waitlisted, v_comedians
  FROM spot_requests r
  JOIN spots p ON p.id = r.spot_id
  JOIN venue_shows s ON s.id = p.show_id
  WHERE s.venue_producer_id = v_owner
    AND NOT s.is_cancelled
    AND venue_show_is_upcoming(s.date, s.end_time)
    AND r.status IN ('pending', 'accepted', 'waitlisted');

  RETURN json_build_object(
    'success', true,
    'shows', v_shows,
    'spots', v_pools,
    'requests', json_build_object(
      'pending', v_pending,
      'accepted', v_accepted,
      'waitlisted', v_waitlisted,
      'total', v_pending + v_accepted + v_waitlisted
    ),
    'comedians', v_comedians
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Suspend: flag + cancel everything upcoming, in one transaction.
-- ---------------------------------------------------------------------------

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

  -- The row lock makes the state check and the update one step: two admins
  -- racing cannot both suspend, and an unsuspend waits for us.
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

  -- Upcoming shows first; the pools and requests follow from their ids so all
  -- three layers use the same set. A venue with no owner has no shows.
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

  -- Pools already cancelled on their own keep their original message.
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

-- ---------------------------------------------------------------------------
-- Unsuspend: clears the suspension only. Cancelled shows and requests stay
-- cancelled; the owner adds new shows. p_admin_id is accepted so the audit log
-- can plug in later.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_unsuspend_venue(
  p_venue_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspended boolean;
BEGIN
  SELECT is_suspended INTO v_suspended FROM venues WHERE id = p_venue_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;
  IF NOT v_suspended THEN
    RETURN json_build_object('success', false, 'error', 'Venue is not suspended');
  END IF;

  UPDATE venues
  SET is_suspended = false,
      suspension_reason = NULL,
      suspended_at = NULL,
      suspended_by = NULL
  WHERE id = p_venue_id;

  RETURN json_build_object('success', true, 'venue_id', p_venue_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Service role only; the API authorizes the admin first.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION venue_show_is_upcoming(date, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION venue_suspension_preview(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_suspend_venue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_unsuspend_venue(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION venue_show_is_upcoming(date, time) TO service_role;
GRANT EXECUTE ON FUNCTION venue_suspension_preview(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_suspend_venue(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_unsuspend_venue(uuid, uuid) TO service_role;

COMMIT;

-- Migration: allow a comedian to cancel their own spot_request while it is
-- still 'pending' or 'waitlisted', not just after it has been 'accepted'.
-- Apply manually against Supabase after 015_shows_and_spot_pools.sql.
-- Replaces comedian_cancel_spot_request() from 007_spot_functions.sql.
--
-- Cancelling an 'accepted' request keeps freeing the real slot
-- (spots.available_spots += 1, capped at total_spots) exactly as before —
-- that's what lets the venue dashboard show the open space and manually
-- promote someone off the waitlist. Cancelling a 'pending' or 'waitlisted'
-- request never held a slot, so it must NOT touch available_spots — it
-- simply drops out of the venue dashboard's pending/waitlisted lists.

CREATE OR REPLACE FUNCTION comedian_cancel_spot_request(
  p_request_id uuid,
  p_comedian_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request spot_requests%ROWTYPE;
  v_spot spots%ROWTYPE;
  v_original_status spot_request_status_enum;
BEGIN
  SELECT * INTO v_request
  FROM spot_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.comedian_id IS DISTINCT FROM p_comedian_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to modify this request');
  END IF;

  IF v_request.status NOT IN ('accepted', 'pending', 'waitlisted') THEN
    RETURN json_build_object('success', false, 'error', 'Only a pending, waitlisted, or accepted request can be cancelled');
  END IF;

  v_original_status := v_request.status;

  UPDATE spot_requests
  SET status = 'cancelled_by_comedian',
      decided_at = now()
  WHERE id = p_request_id;

  IF v_original_status = 'accepted' THEN
    SELECT * INTO v_spot
    FROM spots
    WHERE id = v_request.spot_id
    FOR UPDATE;

    UPDATE spots
    SET available_spots = LEAST(available_spots + 1, total_spots)
    WHERE id = v_spot.id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'request_id', p_request_id,
    'spot_id', v_request.spot_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

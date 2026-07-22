-- Migration: venue producer cancels an already-accepted spot request.
-- Apply manually against Supabase after 009_fix_platform_stats_role.sql.
-- Mirrors comedian_cancel_spot_request()'s atomic release pattern (004/007),
-- but from the venue side and restricted to 'accepted' requests only.

CREATE OR REPLACE FUNCTION venue_cancel_spot_request(
  p_request_id uuid,
  p_venue_producer_id uuid,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request spot_requests%ROWTYPE;
  v_spot spots%ROWTYPE;
BEGIN
  SELECT * INTO v_request
  FROM spot_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  SELECT * INTO v_spot
  FROM spots
  WHERE id = v_request.spot_id
  FOR UPDATE;

  IF v_spot.venue_producer_id IS DISTINCT FROM p_venue_producer_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to act on this spot');
  END IF;

  IF v_request.status != 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'Only an accepted request can be cancelled');
  END IF;

  UPDATE spot_requests
  SET status = 'cancelled_by_venue',
      venue_message = COALESCE(NULLIF(trim(p_message), ''), venue_message),
      decided_at = now()
  WHERE id = p_request_id;

  UPDATE spots
  SET available_spots = LEAST(available_spots + 1, total_spots)
  WHERE id = v_spot.id;

  RETURN json_build_object(
    'success', true,
    'request_id', p_request_id,
    'spot_id', v_spot.id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

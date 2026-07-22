-- Migration: SECURITY DEFINER functions for the spot/spot_request state
-- machine (venue producer dashboard). Apply manually after 006_spots_rls.sql.
-- Same atomic/row-locked pattern as book_show_spot() and
-- comedian_cancel_booking() in functions.sql / migration 004.
-- See specs/venue-dashboard.md §3 for the state machine this implements.

-- Comedian applies to a spot.
CREATE OR REPLACE FUNCTION apply_to_spot(
  p_spot_id uuid,
  p_comedian_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spot spots%ROWTYPE;
  v_request spot_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_spot
  FROM spots
  WHERE id = p_spot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Spot not found');
  END IF;

  IF v_spot.is_cancelled THEN
    RETURN json_build_object('success', false, 'error', 'Spot is cancelled');
  END IF;

  IF v_spot.date < CURRENT_DATE THEN
    RETURN json_build_object('success', false, 'error', 'Spot has already passed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM spot_requests
    WHERE spot_id = p_spot_id
    AND comedian_id = p_comedian_id
    AND status IN ('pending', 'accepted', 'waitlisted')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active request for this spot');
  END IF;

  INSERT INTO spot_requests (spot_id, comedian_id, status)
  VALUES (p_spot_id, p_comedian_id, 'pending')
  RETURNING * INTO v_request;

  RETURN json_build_object(
    'success', true,
    'request_id', v_request.id,
    'status', v_request.status
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Venue producer accepts a pending request, or promotes a waitlisted one.
-- One function covers both since the endpoint (POST /spot-requests/:id/accept)
-- does the same thing regardless of the request's starting status.
CREATE OR REPLACE FUNCTION accept_spot_request(
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

  IF v_spot.is_cancelled THEN
    RETURN json_build_object('success', false, 'error', 'Spot is cancelled');
  END IF;

  IF v_request.status NOT IN ('pending', 'waitlisted') THEN
    RETURN json_build_object('success', false, 'error', 'Request is not pending or waitlisted');
  END IF;

  IF v_spot.available_spots <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No spots available');
  END IF;

  UPDATE spot_requests
  SET status = 'accepted',
      venue_message = p_message,
      decided_at = now()
  WHERE id = p_request_id;

  UPDATE spots
  SET available_spots = available_spots - 1
  WHERE id = v_spot.id
  RETURNING * INTO v_spot;

  IF v_spot.available_spots = 0 THEN
    UPDATE spot_requests
    SET status = 'waitlisted',
        decided_at = now()
    WHERE spot_id = v_spot.id
    AND status = 'pending';
  END IF;

  RETURN json_build_object(
    'success', true,
    'request_id', p_request_id,
    'spot_id', v_spot.id,
    'available_spots', v_spot.available_spots
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Comedian cancels their own accepted request, freeing the slot back up.
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

  IF v_request.status != 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'Only an accepted request can be cancelled');
  END IF;

  SELECT * INTO v_spot
  FROM spots
  WHERE id = v_request.spot_id
  FOR UPDATE;

  UPDATE spot_requests
  SET status = 'cancelled_by_comedian',
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

-- Venue producer cancels an entire spot. Cascades non-terminal requests to
-- cancelled_by_venue; requests already cancelled_by_comedian are left as-is
-- so that history is preserved.
CREATE OR REPLACE FUNCTION cancel_spot(
  p_spot_id uuid,
  p_venue_producer_id uuid,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spot spots%ROWTYPE;
  v_final_message text;
BEGIN
  SELECT * INTO v_spot
  FROM spots
  WHERE id = p_spot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Spot not found');
  END IF;

  IF v_spot.venue_producer_id IS DISTINCT FROM p_venue_producer_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to act on this spot');
  END IF;

  IF v_spot.is_cancelled THEN
    RETURN json_build_object('success', false, 'error', 'Spot is already cancelled');
  END IF;

  v_final_message := NULLIF(trim(p_message), '');
  IF v_final_message IS NULL THEN
    v_final_message := 'Spot canceled by venue';
  END IF;

  UPDATE spots
  SET is_cancelled = true,
      cancellation_message = v_final_message
  WHERE id = p_spot_id;

  UPDATE spot_requests
  SET status = 'cancelled_by_venue',
      decided_at = now()
  WHERE spot_id = p_spot_id
  AND status IN ('pending', 'accepted', 'waitlisted');

  RETURN json_build_object(
    'success', true,
    'spot_id', p_spot_id,
    'cancellation_message', v_final_message
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

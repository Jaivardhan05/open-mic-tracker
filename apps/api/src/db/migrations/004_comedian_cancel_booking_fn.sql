-- Migration: comedian cancels a booking the venue hasn't acted on yet.
-- Apply manually against Supabase after 003_comedian_cancel_booking.sql
-- (must be a separate transaction from the ALTER TYPE ADD VALUE in 003).
-- See specs/dashboard-spec.md for the status model and transitions.

-- Comedian cancels their own booking while it's still awaiting the venue's
-- decision. Distinct from comedian_decline_booking, which only applies once
-- the venue has confirmed (booking_status = 'confirmed_awaiting_comedian').
-- Same atomic spot-release pattern.
CREATE OR REPLACE FUNCTION comedian_cancel_booking(
  p_booking_id uuid,
  p_comedian_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_show shows%ROWTYPE;
BEGIN
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found'
    );
  END IF;

  IF v_booking.comedian_id IS DISTINCT FROM p_comedian_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to modify this booking'
    );
  END IF;

  IF v_booking.booking_status != 'awaiting_confirmation' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking is no longer awaiting confirmation'
    );
  END IF;

  -- Lock the show row to prevent concurrent double-booking
  -- while we release the held spots
  SELECT * INTO v_show
  FROM shows
  WHERE id = v_booking.show_id
  FOR UPDATE;

  UPDATE shows
  SET available_spots = LEAST(available_spots + v_booking.slots_booked, total_spots)
  WHERE id = v_show.id;

  UPDATE bookings
  SET booking_status = 'cancelled_by_comedian'
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'show_id', v_show.id,
    'released_slots', v_booking.slots_booked
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Migration: booking lifecycle status (venue confirmation / comedian decision)
-- Apply manually against Supabase after 001_comedian_profile_fields.sql.
-- See specs/dashboard-spec.md for the status model and transitions.

CREATE TYPE booking_status_enum AS ENUM (
  'awaiting_confirmation',
  'confirmed_awaiting_comedian',
  'confirmed_paid',
  'declined_by_comedian'
);

ALTER TABLE bookings
  ADD COLUMN booking_status booking_status_enum NOT NULL DEFAULT 'awaiting_confirmation';

CREATE INDEX idx_bookings_status ON bookings(booking_status);

-- Venue producer confirms a pending booking, moving it into the
-- comedian's Reminders/Confirmations queue.
CREATE OR REPLACE FUNCTION venue_confirm_booking(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  UPDATE bookings
  SET booking_status = 'confirmed_awaiting_comedian'
  WHERE id = p_booking_id
  AND booking_status = 'awaiting_confirmation'
  RETURNING * INTO v_booking;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found or not awaiting confirmation'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'booking_status', v_booking.booking_status
  );
END;
$$;

-- Comedian declines a venue-confirmed booking. Atomically releases the
-- held spots back to the show, mirroring book_show_spot()'s locking pattern.
CREATE OR REPLACE FUNCTION comedian_decline_booking(
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

  IF v_booking.booking_status != 'confirmed_awaiting_comedian' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking is not awaiting a decision'
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
  SET booking_status = 'declined_by_comedian'
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

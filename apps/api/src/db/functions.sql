-- Database Functions for OpenMic Platform
-- Run after schema.sql, before rls.sql
-- These functions run with SECURITY DEFINER
-- meaning they execute with the privileges
-- of the function owner, not the caller.
-- This is how we enforce business rules
-- that bypass RLS safely.

CREATE OR REPLACE FUNCTION book_show_spot(
  p_show_id uuid,
  p_comedian_id uuid,
  p_slots integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show shows%ROWTYPE;
  v_booking bookings%ROWTYPE;
BEGIN
  IF p_slots <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Slots must be greater than zero'
    );
  END IF;

  -- Lock the show row to prevent
  -- concurrent double-booking
  SELECT * INTO v_show
  FROM shows
  WHERE id = p_show_id
  FOR UPDATE;

  -- Validate show exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Show not found'
    );
  END IF;

  -- Validate show is not cancelled
  IF v_show.is_cancelled THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Show is cancelled'
    );
  END IF;

  -- Validate show date is not in the past
  IF v_show.date < CURRENT_DATE THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Show has already passed'
    );
  END IF;

  -- Validate enough spots available
  IF v_show.available_spots < p_slots THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not enough spots available',
      'available', v_show.available_spots
    );
  END IF;

  -- Decrement available spots atomically
  UPDATE shows
  SET available_spots = available_spots - p_slots
  WHERE id = p_show_id;

  -- Create the booking record
  INSERT INTO bookings (
    comedian_id,
    show_id,
    slots_booked,
    payment_status
  ) VALUES (
    p_comedian_id,
    p_show_id,
    p_slots,
    'pending'
  )
  RETURNING * INTO v_booking;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'slots_booked', p_slots,
    'remaining_spots', v_show.available_spots - p_slots
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_approve_venue(p_venue_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue venues%ROWTYPE;
BEGIN
  UPDATE venues
  SET
    admin_approved = true,
    verified = true,
    updated_at = now()
  WHERE id = p_venue_id
  RETURNING * INTO v_venue;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Venue not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'venue_id', v_venue.id,
    'venue_name', v_venue.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_venue(
  p_venue_id uuid,
  p_reason text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE venues
  SET
    admin_approved = false,
    verified = false,
    is_active = false,
    updated_at = now()
  WHERE id = p_venue_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Venue not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'reason', p_reason
  );
END;
$$;

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
        WHERE is_active = true),
    'pending_approvals',
      (SELECT COUNT(*) FROM venues
        WHERE admin_approved = false
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
        WHERE role = 'venue_owner')
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

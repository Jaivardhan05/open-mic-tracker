-- Migration: legacy System-1 bookings are only allowed for a venue the public
-- can see (approved, active, not hidden, not suspended: venue_is_public, 018).
-- Apply manually against Supabase after 022_protect_user_role.sql.
-- See specs/admin-venue-management.md (step 4b).
--
-- Why: POST /api/shows/:id/book -> book_show_spot() never looked at the venue,
-- so a comedian could book a show at a hidden, suspended or unapproved venue.
-- book_show_spot takes p_comedian_id as a parameter and, like the other older
-- SECURITY DEFINER functions, may be callable with the anon key, so an API-only
-- check would not close it. A trigger on bookings covers the function, the
-- API and the direct-insert policy (bookings_insert_own) alike, the same
-- reasoning as the 020 spot gate.
--
-- Only INSERT is gated. Existing bookings are untouched and can still be
-- confirmed, cancelled or declined (decided: gate only, do not cancel legacy
-- bookings when a venue is suspended).
--
-- Writes with no request JWT claims at all (SQL editor, migrations, psql) are
-- exempt so seeding keeps working; every PostgREST call, including the API's
-- service-role client, carries claims and is checked.
--
-- The 9 hidden venues in the current data carry legacy shows; bookings for
-- those are now rejected too (they are already absent from GET /api/shows).

BEGIN;

CREATE OR REPLACE FUNCTION bookings_venue_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT venue_id INTO v_venue_id FROM shows WHERE id = NEW.show_id;

  IF v_venue_id IS NULL OR NOT venue_is_public(v_venue_id) THEN
    RAISE EXCEPTION 'This venue is not taking bookings right now' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_venue_gate ON bookings;
CREATE TRIGGER trg_bookings_venue_gate
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_venue_gate();

COMMIT;

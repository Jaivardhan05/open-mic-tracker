-- Migration: introduce venue_shows (the "Show" parent) and turn the
-- existing flat `spots` table into its child "Spot" pool rows, with a
-- third spot_type ('hosting'). Apply manually after 014_update_spot.sql.
-- See specs/venue-dashboard.md §9 for the full data model and rationale.
--
-- Scope: venue-producer dashboard only. The legacy `shows` table
-- (schema.sql) and the comedian-facing /venues pages are untouched;
-- GET /api/spots keeps its old flat shape for them (see index.ts).

-- 'hosting' joins the existing enum shared with the legacy `shows` table;
-- harmless there since `shows.spot_type` never uses it.
ALTER TYPE spot_type_enum ADD VALUE IF NOT EXISTS 'hosting';

CREATE TABLE venue_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_producer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time),
  is_cancelled boolean NOT NULL DEFAULT false,
  cancellation_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_shows_venue_producer_id ON venue_shows(venue_producer_id);
CREATE INDEX idx_venue_shows_date ON venue_shows(date);

-- Mirrors the spots_owner_all / spots_public_read pattern from 006_spots_rls.sql.
ALTER TABLE venue_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_shows_owner_all"
  ON venue_shows FOR ALL
  TO authenticated
  USING (auth.uid() = venue_producer_id)
  WITH CHECK (auth.uid() = venue_producer_id);

CREATE POLICY "venue_shows_public_read"
  ON venue_shows FOR SELECT
  TO anon, authenticated
  USING (is_cancelled = false);

ALTER TABLE spots ADD COLUMN show_id uuid REFERENCES venue_shows(id) ON DELETE CASCADE;

-- Backfill: every existing spots row currently represents a whole show
-- (one row = one date/time/producer). Give each one its own venue_shows
-- parent row-by-row (rather than a join-based INSERT) so there's no risk
-- of mismatching rows that happen to share identical date/time/producer.
DO $$
DECLARE
  r spots%ROWTYPE;
  v_show_id uuid;
BEGIN
  FOR r IN SELECT * FROM spots WHERE show_id IS NULL LOOP
    INSERT INTO venue_shows (venue_producer_id, date, start_time, end_time, is_cancelled, cancellation_message, created_at)
    VALUES (r.venue_producer_id, r.date, r.start_time, r.end_time, r.is_cancelled, r.cancellation_message, r.created_at)
    RETURNING id INTO v_show_id;

    UPDATE spots SET show_id = v_show_id WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE spots ALTER COLUMN show_id SET NOT NULL;
CREATE INDEX idx_spots_show_id ON spots(show_id);

-- Only one active pool row per (show, type) — an inactive (is_cancelled)
-- row can coexist with a reactivated one only briefly during an edit, so
-- this is enforced at the application/function level (see update_show()
-- below), not as a DB constraint, to allow that reactivate-in-place flow.

-- Create a show + up to three of its spot pools atomically.
CREATE OR REPLACE FUNCTION create_show(
  p_venue_producer_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_busking_spots integer,
  p_busking_price numeric,
  p_non_busking_spots integer,
  p_non_busking_price numeric,
  p_hosting boolean,
  p_hosting_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show venue_shows%ROWTYPE;
BEGIN
  IF p_end_time <= p_start_time THEN
    RETURN json_build_object('success', false, 'error', 'end_time must be after start_time');
  END IF;

  IF p_busking_spots IS NULL OR p_busking_spots < 0 OR p_busking_spots > 100 THEN
    RETURN json_build_object('success', false, 'error', 'busking_spots must be an integer between 0 and 100');
  END IF;

  IF p_non_busking_spots IS NULL OR p_non_busking_spots < 0 OR p_non_busking_spots > 100 THEN
    RETURN json_build_object('success', false, 'error', 'non_busking_spots must be an integer between 0 and 100');
  END IF;

  IF p_busking_spots = 0 AND p_non_busking_spots = 0 AND NOT COALESCE(p_hosting, false) THEN
    RETURN json_build_object('success', false, 'error', 'At least one of busking, non-busking, or hosting must have a spot');
  END IF;

  INSERT INTO venue_shows (venue_producer_id, date, start_time, end_time)
  VALUES (p_venue_producer_id, p_date, p_start_time, p_end_time)
  RETURNING * INTO v_show;

  IF p_busking_spots > 0 THEN
    INSERT INTO spots (show_id, venue_producer_id, date, start_time, end_time, spot_type, total_spots, available_spots, price)
    VALUES (v_show.id, p_venue_producer_id, p_date, p_start_time, p_end_time, 'busking', p_busking_spots, p_busking_spots, p_busking_price);
  END IF;

  IF p_non_busking_spots > 0 THEN
    INSERT INTO spots (show_id, venue_producer_id, date, start_time, end_time, spot_type, total_spots, available_spots, price)
    VALUES (v_show.id, p_venue_producer_id, p_date, p_start_time, p_end_time, 'non_busking', p_non_busking_spots, p_non_busking_spots, p_non_busking_price);
  END IF;

  IF COALESCE(p_hosting, false) THEN
    INSERT INTO spots (show_id, venue_producer_id, date, start_time, end_time, spot_type, total_spots, available_spots, price)
    VALUES (v_show.id, p_venue_producer_id, p_date, p_start_time, p_end_time, 'hosting', 1, 1, p_hosting_price);
  END IF;

  RETURN json_build_object('success', true, 'show_id', v_show.id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Edit a show's date + all three pools in one call. Supersedes update_spot().
CREATE OR REPLACE FUNCTION update_show(
  p_show_id uuid,
  p_venue_producer_id uuid,
  p_date date,
  p_busking_spots integer,
  p_busking_price numeric,
  p_non_busking_spots integer,
  p_non_busking_price numeric,
  p_hosting boolean,
  p_hosting_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show venue_shows%ROWTYPE;
  v_pool_type text;
  v_target integer;
  v_price numeric;
  v_row spots%ROWTYPE;
  v_accepted integer;
  v_notice text;
BEGIN
  SELECT * INTO v_show FROM venue_shows WHERE id = p_show_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Show not found');
  END IF;

  IF v_show.venue_producer_id IS DISTINCT FROM p_venue_producer_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to act on this show');
  END IF;

  IF v_show.is_cancelled THEN
    RETURN json_build_object('success', false, 'error', 'Show is cancelled');
  END IF;

  IF p_busking_spots IS NULL OR p_busking_spots < 0 OR p_busking_spots > 100 THEN
    RETURN json_build_object('success', false, 'error', 'busking_spots must be an integer between 0 and 100');
  END IF;

  IF p_non_busking_spots IS NULL OR p_non_busking_spots < 0 OR p_non_busking_spots > 100 THEN
    RETURN json_build_object('success', false, 'error', 'non_busking_spots must be an integer between 0 and 100');
  END IF;

  IF p_busking_spots = 0 AND p_non_busking_spots = 0 AND NOT COALESCE(p_hosting, false) THEN
    RETURN json_build_object('success', false, 'error', 'At least one of busking, non-busking, or hosting must have a spot');
  END IF;

  -- Pass 1: validate every pool's accepted-count guard before touching anything.
  FOR v_pool_type, v_target IN
    SELECT * FROM (VALUES
      ('busking', p_busking_spots),
      ('non_busking', p_non_busking_spots),
      ('hosting', CASE WHEN COALESCE(p_hosting, false) THEN 1 ELSE 0 END)
    ) AS t(pool_type, target)
  LOOP
    SELECT * INTO v_row FROM spots WHERE show_id = p_show_id AND spot_type = v_pool_type::spot_type_enum AND NOT is_cancelled FOR UPDATE;

    v_accepted := 0;
    IF FOUND THEN
      SELECT count(*) INTO v_accepted FROM spot_requests WHERE spot_id = v_row.id AND status = 'accepted';
    END IF;

    IF v_target < v_accepted THEN
      RETURN json_build_object(
        'success', false,
        'error', format(
          '%s comedian%s already accepted for %s. Cancel enough accepted requests to bring that at or below %s before lowering it.',
          v_accepted,
          CASE WHEN v_accepted = 1 THEN '' ELSE 's' END,
          replace(v_pool_type, '_', '-'),
          v_target
        )
      );
    END IF;
  END LOOP;

  -- Pass 2: apply each pool.
  FOR v_pool_type, v_target, v_price IN
    SELECT * FROM (VALUES
      ('busking', p_busking_spots, p_busking_price),
      ('non_busking', p_non_busking_spots, p_non_busking_price),
      ('hosting', CASE WHEN COALESCE(p_hosting, false) THEN 1 ELSE 0 END, p_hosting_price)
    ) AS t(pool_type, target, price)
  LOOP
    SELECT * INTO v_row FROM spots WHERE show_id = p_show_id AND spot_type = v_pool_type::spot_type_enum FOR UPDATE;

    v_accepted := 0;
    IF FOUND AND NOT v_row.is_cancelled THEN
      SELECT count(*) INTO v_accepted FROM spot_requests WHERE spot_id = v_row.id AND status = 'accepted';
    END IF;

    IF v_target = 0 THEN
      IF FOUND AND NOT v_row.is_cancelled THEN
        UPDATE spots SET is_cancelled = true WHERE id = v_row.id;
        UPDATE spot_requests SET status = 'cancelled_by_venue', decided_at = now()
        WHERE spot_id = v_row.id AND status IN ('pending', 'waitlisted');
      END IF;
    ELSE
      IF FOUND THEN
        UPDATE spots
        SET is_cancelled = false,
            date = p_date,
            total_spots = v_target,
            available_spots = v_target - v_accepted,
            price = v_price
        WHERE id = v_row.id;
      ELSE
        INSERT INTO spots (show_id, venue_producer_id, date, start_time, end_time, spot_type, total_spots, available_spots, price)
        VALUES (p_show_id, v_show.venue_producer_id, p_date, v_show.start_time, v_show.end_time, v_pool_type::spot_type_enum, v_target, v_target, v_price);
      END IF;
    END IF;
  END LOOP;

  UPDATE venue_shows SET date = p_date WHERE id = p_show_id;

  v_notice := format(
    'This show was updated by the venue: %s. Busking: %s spot%s (%s). Non-Busking: %s spot%s (%s). Hosting: %s (%s).',
    to_char(p_date, 'FMDD Mon YYYY'),
    p_busking_spots, CASE WHEN p_busking_spots = 1 THEN '' ELSE 's' END,
    CASE WHEN p_busking_price IS NULL OR p_busking_price = 0 THEN 'Free' ELSE '₹' || p_busking_price::text END,
    p_non_busking_spots, CASE WHEN p_non_busking_spots = 1 THEN '' ELSE 's' END,
    CASE WHEN p_non_busking_price IS NULL OR p_non_busking_price = 0 THEN 'Free' ELSE '₹' || p_non_busking_price::text END,
    CASE WHEN COALESCE(p_hosting, false) THEN 'Yes' ELSE 'No' END,
    CASE WHEN p_hosting_price IS NULL OR p_hosting_price = 0 THEN 'Free' ELSE '₹' || p_hosting_price::text END
  );

  UPDATE spot_requests
  SET edit_notice = v_notice,
      edit_notice_at = now()
  WHERE spot_id IN (SELECT id FROM spots WHERE show_id = p_show_id)
  AND status IN ('accepted', 'waitlisted');

  RETURN json_build_object('success', true, 'show_id', p_show_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Cancel a whole show: cascades to every pool + every non-terminal request
-- across all of them. Supersedes cancel_spot().
CREATE OR REPLACE FUNCTION cancel_show(
  p_show_id uuid,
  p_venue_producer_id uuid,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show venue_shows%ROWTYPE;
  v_final_message text;
BEGIN
  SELECT * INTO v_show FROM venue_shows WHERE id = p_show_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Show not found');
  END IF;

  IF v_show.venue_producer_id IS DISTINCT FROM p_venue_producer_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to act on this show');
  END IF;

  IF v_show.is_cancelled THEN
    RETURN json_build_object('success', false, 'error', 'Show is already cancelled');
  END IF;

  v_final_message := NULLIF(trim(p_message), '');
  IF v_final_message IS NULL THEN
    v_final_message := 'Show canceled by venue';
  END IF;

  UPDATE venue_shows
  SET is_cancelled = true,
      cancellation_message = v_final_message
  WHERE id = p_show_id;

  UPDATE spots
  SET is_cancelled = true,
      cancellation_message = v_final_message
  WHERE show_id = p_show_id;

  UPDATE spot_requests
  SET status = 'cancelled_by_venue',
      decided_at = now()
  WHERE spot_id IN (SELECT id FROM spots WHERE show_id = p_show_id)
  AND status IN ('pending', 'accepted', 'waitlisted');

  RETURN json_build_object('success', true, 'show_id', p_show_id, 'cancellation_message', v_final_message);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Superseded by update_show() / cancel_show() above.
DROP FUNCTION IF EXISTS update_spot(uuid, uuid, date, text, integer, numeric);
DROP FUNCTION IF EXISTS cancel_spot(uuid, uuid, text);

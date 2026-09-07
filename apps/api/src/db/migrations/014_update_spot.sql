-- Migration: allow a venue producer to edit an existing spot's total_spots,
-- price, date, and spot_type post-creation. Supersedes the "no edit after
-- creation" line in specs/venue-dashboard.md §7 (now removed there).
-- Same atomic/row-locked SECURITY DEFINER pattern as cancel_spot() etc. in
-- 007_spot_functions.sql. Apply manually after 013_venue_x_url.sql.

-- Notice surfaced to comedians on the request card (SpotRequestCard) when a
-- spot they're accepted/waitlisted on is edited. Separate from
-- venue_message (which is tied to the accept/promote action) so editing a
-- spot never overwrites an existing accept note. Pending requests are never
-- notified — they haven't been confirmed onto the spot yet.
ALTER TABLE spot_requests
  ADD COLUMN IF NOT EXISTS edit_notice text,
  ADD COLUMN IF NOT EXISTS edit_notice_at timestamptz;

CREATE OR REPLACE FUNCTION update_spot(
  p_spot_id uuid,
  p_venue_producer_id uuid,
  p_date date,
  p_spot_type text,
  p_total_spots integer,
  p_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spot spots%ROWTYPE;
  v_accepted_count integer;
  v_notice text;
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
    RETURN json_build_object('success', false, 'error', 'Spot is cancelled');
  END IF;

  IF p_spot_type NOT IN ('busking', 'non_busking') THEN
    RETURN json_build_object('success', false, 'error', 'spot_type must be busking or non_busking');
  END IF;

  IF p_total_spots IS NULL OR p_total_spots <= 0 OR p_total_spots > 100 THEN
    RETURN json_build_object('success', false, 'error', 'total_spots must be an integer between 1 and 100');
  END IF;

  -- Decrement guard: total_spots can never drop below the number of
  -- currently accepted requests. Increasing has no such restriction.
  SELECT count(*) INTO v_accepted_count
  FROM spot_requests
  WHERE spot_id = p_spot_id
  AND status = 'accepted';

  IF p_total_spots < v_accepted_count THEN
    RETURN json_build_object(
      'success', false,
      'error', format(
        '%s comedian%s already accepted for this spot. Cancel enough accepted requests to bring that at or below %s before lowering total spots.',
        v_accepted_count,
        CASE WHEN v_accepted_count = 1 THEN '' ELSE 's' END,
        p_total_spots
      )
    );
  END IF;

  -- available_spots tracks remaining capacity under the new total, keeping
  -- the same "total - accepted" invariant accept_spot_request() maintains.
  UPDATE spots
  SET date = p_date,
      spot_type = p_spot_type::spot_type_enum,
      total_spots = p_total_spots,
      available_spots = p_total_spots - v_accepted_count,
      price = p_price
  WHERE id = p_spot_id
  RETURNING * INTO v_spot;

  v_notice := format(
    'This spot was updated by the venue: %s, %s spot%s total, %s.',
    to_char(p_date, 'FMDD Mon YYYY'),
    p_total_spots,
    CASE WHEN p_total_spots = 1 THEN '' ELSE 's' END,
    CASE WHEN p_price IS NULL OR p_price = 0 THEN 'Free' ELSE '₹' || p_price::text END
  );

  UPDATE spot_requests
  SET edit_notice = v_notice,
      edit_notice_at = now()
  WHERE spot_id = p_spot_id
  AND status IN ('accepted', 'waitlisted');

  RETURN json_build_object('success', true, 'spot', row_to_json(v_spot));

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

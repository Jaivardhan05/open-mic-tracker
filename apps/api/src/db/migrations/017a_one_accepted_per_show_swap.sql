-- Migration: at most one 'accepted' spot_request per (show, comedian), with an
-- atomic "swap" when the venue owner accepts a second request for a comedian
-- who is already accepted elsewhere in the same show.
-- Apply manually against Supabase after 016_comedian_cancel_pending_waitlisted.sql.
-- See specs/venue-dashboard.md (one-accepted-per-show section).
--
-- This file is the SAFE half: it adds a column, a trigger and a replacement
-- accept_spot_request(). It does NOT add the unique index, because existing
-- data may already contain a comedian accepted twice in one show. Run the
-- duplicate report in 017b_one_accepted_per_show_index.sql first; apply 017b
-- only once any duplicates are resolved.
--
-- Design:
--  * spot_requests.show_id (denormalised from spots.show_id) lets a partial
--    unique index span the three pool rows of a show.
--  * accept_spot_request() serialises per (show, comedian) with an advisory
--    transaction lock, re-validates under row locks, and on a swap releases
--    the old accepted request BEFORE accepting the new one so the 017b index
--    is never violated mid-transaction.
--  * Releasing the old spot follows the existing cancel rule: available_spots
--    + 1 (capped); nobody is auto-promoted into it.

ALTER TABLE spot_requests ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES venue_shows(id) ON DELETE CASCADE;

-- Keep show_id correct for every insert path, including the direct-insert RLS
-- policy "spot_requests_insert_own" (006). SECURITY DEFINER so the lookup is
-- not filtered by spots RLS.
CREATE OR REPLACE FUNCTION set_spot_request_show_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SELECT show_id INTO NEW.show_id FROM spots WHERE id = NEW.spot_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spot_requests_set_show_id ON spot_requests;
CREATE TRIGGER trg_spot_requests_set_show_id
  BEFORE INSERT ON spot_requests
  FOR EACH ROW EXECUTE FUNCTION set_spot_request_show_id();

-- Backfill only the new column; no existing status/count is modified.
UPDATE spot_requests r
SET show_id = s.show_id
FROM spots s
WHERE s.id = r.spot_id
AND r.show_id IS NULL;

ALTER TABLE spot_requests ALTER COLUMN show_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spot_requests_show_comedian ON spot_requests (show_id, comedian_id);

-- Replaces the 3-argument version from 007. The old signature is dropped so the
-- new one (with the optional 4th argument) is not an ambiguous overload.
DROP FUNCTION IF EXISTS accept_spot_request(uuid, uuid, text);

CREATE OR REPLACE FUNCTION accept_spot_request(
  p_request_id uuid,
  p_venue_producer_id uuid,
  p_message text DEFAULT NULL,
  p_swap_from_request_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id uuid;
  v_comedian_id uuid;
  v_target_spot_id uuid;
  v_request spot_requests%ROWTYPE;
  v_spot spots%ROWTYPE;
  v_old_request spot_requests%ROWTYPE;
  v_old_spot spots%ROWTYPE;
  v_sibling_count integer;
  v_old_label text;
  v_swapped boolean := false;
BEGIN
  -- Unlocked read, only to learn which (show, comedian) to serialise on and
  -- to authorise before taking any lock.
  SELECT r.show_id, r.comedian_id, r.spot_id
  INTO v_show_id, v_comedian_id, v_target_spot_id
  FROM spot_requests r
  WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'not_found', 'error', 'Request not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM spots WHERE id = v_target_spot_id AND venue_producer_id = p_venue_producer_id
  ) THEN
    RETURN json_build_object('success', false, 'code', 'forbidden', 'error', 'Not authorized to act on this spot');
  END IF;

  -- One accept/swap at a time per (show, comedian).
  PERFORM pg_advisory_xact_lock(hashtextextended('accept:' || v_show_id::text || ':' || v_comedian_id::text, 0));

  -- Lock order: target request, sibling accepted request, then spots by id.
  SELECT * INTO v_request FROM spot_requests WHERE id = p_request_id FOR UPDATE;

  SELECT count(*) INTO v_sibling_count
  FROM spot_requests
  WHERE show_id = v_show_id
  AND comedian_id = v_comedian_id
  AND status = 'accepted'
  AND id <> p_request_id;

  IF v_sibling_count > 1 THEN
    RETURN json_build_object(
      'success', false,
      'code', 'duplicate_accepted',
      'error', 'This comedian is already accepted for more than one spot in this show. Resolve that before accepting another.'
    );
  END IF;

  IF v_sibling_count = 1 THEN
    SELECT * INTO v_old_request
    FROM spot_requests
    WHERE show_id = v_show_id
    AND comedian_id = v_comedian_id
    AND status = 'accepted'
    AND id <> p_request_id
    FOR UPDATE;
    -- NOT FOUND here means it was cancelled while we waited for the lock;
    -- v_old_request.id is then NULL and we fall through as "no sibling".
  END IF;

  PERFORM 1
  FROM spots
  WHERE id IN (v_request.spot_id, v_old_request.spot_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_spot FROM spots WHERE id = v_request.spot_id;

  IF v_spot.venue_producer_id IS DISTINCT FROM p_venue_producer_id THEN
    RETURN json_build_object('success', false, 'code', 'forbidden', 'error', 'Not authorized to act on this spot');
  END IF;

  IF v_spot.is_cancelled THEN
    RETURN json_build_object('success', false, 'code', 'spot_cancelled', 'error', 'Spot is cancelled');
  END IF;

  IF v_request.status NOT IN ('pending', 'waitlisted') THEN
    RETURN json_build_object('success', false, 'code', 'not_pending', 'error', 'Request is not pending or waitlisted');
  END IF;

  IF v_old_request.id IS NOT NULL THEN
    SELECT * INTO v_old_spot FROM spots WHERE id = v_old_request.spot_id;
    v_old_label := replace(v_old_spot.spot_type::text, '_', '-');

    IF p_swap_from_request_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'code', 'swap_required',
        'error', format('This comedian is already accepted for %s. Confirm the swap to accept this request.', v_old_label)
      );
    END IF;

    IF p_swap_from_request_id IS DISTINCT FROM v_old_request.id THEN
      RETURN json_build_object(
        'success', false,
        'code', 'stale_swap',
        'error', format('This comedian''s situation changed: they are now accepted for %s. Review and try again.', v_old_label)
      );
    END IF;
  ELSIF p_swap_from_request_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'code', 'swap_not_needed',
      'error', 'The comedian''s earlier spot was already cancelled. You can accept this request normally.'
    );
  END IF;

  IF v_spot.available_spots <= 0 THEN
    RETURN json_build_object('success', false, 'code', 'no_spots', 'error', 'No spots available');
  END IF;

  IF v_old_request.id IS NOT NULL THEN
    -- Release first so the one-accepted-per-show index is never violated.
    -- Back to the waiting list as pending; requested_at is untouched so the
    -- original queue position is kept. No auto-promotion into the freed slot.
    UPDATE spot_requests
    SET status = 'pending',
        venue_message = NULL,
        decided_at = NULL
    WHERE id = v_old_request.id;

    UPDATE spots
    SET available_spots = LEAST(available_spots + 1, total_spots)
    WHERE id = v_old_request.spot_id;

    v_swapped := true;
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
    'available_spots', v_spot.available_spots,
    'swapped', v_swapped,
    'released_request_id', v_old_request.id,
    'released_spot_id', v_old_request.spot_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'code', 'conflict',
      'error', 'This comedian was just accepted for another spot in this show. Refresh and try again.'
    );
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'code', 'error', 'error', SQLERRM);
END;
$$;

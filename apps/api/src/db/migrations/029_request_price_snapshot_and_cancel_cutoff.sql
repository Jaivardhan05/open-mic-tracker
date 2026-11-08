-- Migration: lock the price and the cancellation cutoff onto a spot request
-- when it is accepted, let each venue set its own cancellation cutoff, refuse
-- late cancellations of accepted spots, and refuse accepting a request for a
-- show that has already ended. Apply manually against Supabase after
-- 028_admin_venue_stats.sql. See specs/payments-weekly-billing.md (Step 1).
--
-- Why: weekly billing (later steps) needs a price that cannot change after the
-- comedian is accepted, and a comedian must not be able to cancel an accepted
-- spot after the show to dodge the bill. Nothing here creates a bill, a
-- payment or any Razorpay object.
--
-- What this adds:
--   * venues.cancel_cutoff_hours (0 to 12, default 12): how many whole hours
--     before the show starts a comedian may still cancel an ACCEPTED spot. The
--     owner chooses it; 12 is also the maximum.
--   * spot_requests.price_paise_at_request: the spot's price when the request
--     was made. EVIDENCE ONLY, billing never reads it. NULL for rows that
--     existed before this migration (the real value is unrecoverable).
--   * spot_requests.price_paise_at_accept: the price locked at the moment of
--     acceptance, in paise. This is the billed price. Free (NULL or 0) is 0;
--     an invalid price (negative, above 10,000 rupees, or more than 2
--     decimals) is NULL and is excluded from billing later.
--   * spot_requests.cancel_cutoff_hours_at_accept: the venue's cutoff copied
--     at acceptance, so a later owner change never affects an accepted spot.
--   * spot_requests.price_source: how price_paise_at_accept was set
--     ('trigger' = locked live by the trigger below, 'backfill' = copied from
--     the current price by this migration). Data only: no billing effect.
--     NULL while the request holds no accept lock.
--
-- All four spot_requests columns are written ONLY by the trigger below; a
-- value supplied by a client (including a direct PostgREST insert allowed by
-- the spot_requests_insert_own policy) is overwritten. Writes with no JWT
-- claims (the SQL editor) may edit them by hand on an update that is not a
-- status change, the same exemption as the 020 gate; the ended-show refusal
-- and the lock itself always run.
--
-- Behaviour changes visible to users:
--   * a comedian can no longer cancel an ACCEPTED request after the locked
--     cutoff, or at all once the show has started (pending and waitlisted
--     cancels are unrestricted, and the venue can still cancel);
--   * accepting or promoting a request for a show that has ended is refused.
--
-- Rupee amounts stay numeric on spots; paise integers only appear here. The
-- 10,000 rupee ceiling lives ONLY in price_to_paise(); billing step 3
-- re-points it at billing_settings.max_spot_price_paise.
--
-- Existing accepted requests are back-filled (price from the spot's current
-- price, cutoff from the venue's current value). Pending and waitlisted
-- requests get their lock when they are accepted.

BEGIN;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS cancel_cutoff_hours smallint NOT NULL DEFAULT 12
    CONSTRAINT venues_cancel_cutoff_hours_range CHECK (cancel_cutoff_hours BETWEEN 0 AND 12);

ALTER TABLE spot_requests
  ADD COLUMN IF NOT EXISTS price_paise_at_request integer
    CHECK (price_paise_at_request IS NULL OR price_paise_at_request >= 0),
  ADD COLUMN IF NOT EXISTS price_paise_at_accept integer
    CHECK (price_paise_at_accept IS NULL OR price_paise_at_accept >= 0),
  ADD COLUMN IF NOT EXISTS cancel_cutoff_hours_at_accept smallint
    CHECK (cancel_cutoff_hours_at_accept IS NULL OR cancel_cutoff_hours_at_accept BETWEEN 0 AND 12),
  ADD COLUMN IF NOT EXISTS price_source text
    CHECK (price_source IS NULL OR price_source IN ('trigger', 'backfill'));

-- ---------------------------------------------------------------------------
-- Rupees (numeric) to paise (integer). The one place the ceiling is defined.
--   NULL or 0              -> 0      (free)
--   negative, > 10000, or
--   more than 2 decimals   -> NULL   (invalid: never silently rounded)
--   otherwise              -> ROUND(price * 100)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION price_to_paise(p_price numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_price IS NULL THEN 0
    WHEN p_price < 0 THEN NULL
    WHEN p_price > 10000 THEN NULL
    WHEN p_price <> round(p_price, 2) THEN NULL
    ELSE round(p_price * 100)::integer
  END;
$$;

-- ---------------------------------------------------------------------------
-- Back-fill: accepted requests only. Runs BEFORE the trigger exists (like 019)
-- so it does not touch status and is not refused for shows that already ended.
-- price_source IS NULL keeps a re-run from touching rows locked since.
-- ---------------------------------------------------------------------------

UPDATE spot_requests r
SET price_paise_at_accept = price_to_paise(s.price),
    cancel_cutoff_hours_at_accept = COALESCE(
      (SELECT v.cancel_cutoff_hours FROM venues v WHERE v.owner_id = s.venue_producer_id LIMIT 1),
      12
    ),
    price_source = 'backfill'
FROM spots s
WHERE s.id = r.spot_id
  AND r.status = 'accepted'
  AND r.price_source IS NULL;

-- ---------------------------------------------------------------------------
-- Trigger: derive the four columns. Looks the spot up through spot_id, never
-- show_id: same-event triggers fire alphabetically and this one (lock_terms)
-- runs before trg_spot_requests_set_show_id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION spot_requests_lock_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot spots%ROWTYPE;
  v_cutoff smallint;
  v_has_claims boolean := COALESCE(current_setting('request.jwt.claims', true), '') <> '';
  v_becoming_accepted boolean := false;
BEGIN
  -- OLD is only unassigned on INSERT, so it is only read inside
  -- TG_OP = 'UPDATE' branches (nested IFs: OR does not guarantee
  -- short-circuiting).
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_spot FROM spots WHERE id = NEW.spot_id;
    NEW.price_paise_at_request := price_to_paise(v_spot.price);
    NEW.price_paise_at_accept := NULL;
    NEW.cancel_cutoff_hours_at_accept := NULL;
    NEW.price_source := NULL;
    IF NEW.status = 'accepted' THEN
      v_becoming_accepted := true;
    END IF;
  ELSE
    IF v_has_claims THEN
      NEW.price_paise_at_request := OLD.price_paise_at_request;
      NEW.price_paise_at_accept := OLD.price_paise_at_accept;
      NEW.cancel_cutoff_hours_at_accept := OLD.cancel_cutoff_hours_at_accept;
      NEW.price_source := OLD.price_source;
    END IF;

    IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
      v_becoming_accepted := true;
      SELECT * INTO v_spot FROM spots WHERE id = NEW.spot_id;
    ELSIF OLD.status = 'accepted' AND NEW.status IS DISTINCT FROM 'accepted' THEN
      -- Leaving accepted (cancel, swap release, suspend): the lock goes. A
      -- later re-accept locks again at that moment's price and cutoff.
      NEW.price_paise_at_accept := NULL;
      NEW.cancel_cutoff_hours_at_accept := NULL;
      NEW.price_source := NULL;
    END IF;
  END IF;

  IF v_becoming_accepted THEN
    IF NOT venue_show_is_upcoming(v_spot.date, v_spot.end_time) THEN
      RAISE EXCEPTION 'This show has already ended, so the request can no longer be accepted.';
    END IF;

    SELECT v.cancel_cutoff_hours INTO v_cutoff
    FROM venues v
    WHERE v.owner_id = v_spot.venue_producer_id
    LIMIT 1;

    NEW.price_paise_at_accept := price_to_paise(v_spot.price);
    NEW.cancel_cutoff_hours_at_accept := COALESCE(v_cutoff, 12);
    NEW.price_source := 'trigger';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spot_requests_lock_terms ON spot_requests;
CREATE TRIGGER trg_spot_requests_lock_terms
  BEFORE INSERT OR UPDATE ON spot_requests
  FOR EACH ROW EXECUTE FUNCTION spot_requests_lock_terms();

-- ---------------------------------------------------------------------------
-- Comedian cancel: replaces the 016 version. Pending and waitlisted requests
-- cancel exactly as before. An ACCEPTED request can be cancelled only before
-- the show starts AND not later than the cutoff locked at acceptance. The
-- spot row is now locked before the checks (it was locked after the update in
-- 016); the order request -> spot is the same as every other function here.
-- Times are India time, like venue_show_is_upcoming (021).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION comedian_cancel_spot_request(
  p_request_id uuid,
  p_comedian_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request spot_requests%ROWTYPE;
  v_spot spots%ROWTYPE;
  v_original_status spot_request_status_enum;
  v_now timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  v_start timestamp;
  v_cutoff integer;
  v_deadline timestamp;
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

  IF v_original_status = 'accepted' THEN
    SELECT * INTO v_spot
    FROM spots
    WHERE id = v_request.spot_id
    FOR UPDATE;

    v_start := v_spot.date + v_spot.start_time;

    IF v_now >= v_start THEN
      RETURN json_build_object(
        'success', false,
        'code', 'show_started',
        'error', 'This show has already started, so the spot can no longer be cancelled here. Please contact the venue.'
      );
    END IF;

    v_cutoff := COALESCE(v_request.cancel_cutoff_hours_at_accept, 12);
    v_deadline := v_start - make_interval(hours => v_cutoff);

    IF v_now > v_deadline THEN
      RETURN json_build_object(
        'success', false,
        'code', 'cancel_cutoff_passed',
        'cancel_cutoff_hours', v_cutoff,
        'error', format(
          'Cancellation for this spot closed at %s on %s (%s h before the show starts). Please contact the venue.',
          to_char(v_deadline, 'FMHH12:MI AM'),
          to_char(v_deadline, 'FMDD Mon'),
          v_cutoff
        )
      );
    END IF;
  END IF;

  UPDATE spot_requests
  SET status = 'cancelled_by_comedian',
      decided_at = now()
  WHERE id = p_request_id;

  IF v_original_status = 'accepted' THEN
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

-- ---------------------------------------------------------------------------
-- accept_spot_request: the 017a function, byte for byte, plus ONE block that
-- refuses a show that has ended (code 'show_ended'). The block sits after the
-- 'spot_cancelled' check, so every lock is taken and nothing has been written.
-- The price/cutoff lock is NOT here: the trigger above does it for every path.
-- Same signature, so CREATE OR REPLACE keeps the grants (restated below).
-- ---------------------------------------------------------------------------

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

  IF NOT venue_show_is_upcoming(v_spot.date, v_spot.end_time) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'show_ended',
      'error', 'This show has already ended, so the request can no longer be accepted.'
    );
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


-- ---------------------------------------------------------------------------
-- Grants: every function here is callable by the service role only.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION price_to_paise(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION spot_requests_lock_terms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION comedian_cancel_spot_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION accept_spot_request(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION price_to_paise(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION spot_requests_lock_terms() TO service_role;
GRANT EXECUTE ON FUNCTION comedian_cancel_spot_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION accept_spot_request(uuid, uuid, text, uuid) TO service_role;

-- Abort the whole migration if any of them is still reachable by anon or
-- authenticated, or not by service_role (same check as 024).
DO $$
DECLARE
  fns regprocedure[] := ARRAY[
    'price_to_paise(numeric)',
    'spot_requests_lock_terms()',
    'comedian_cancel_spot_request(uuid,uuid)',
    'accept_spot_request(uuid,uuid,text,uuid)'
  ]::regprocedure[];
  bad text;
BEGIN
  SELECT string_agg(f::text, ', ') INTO bad
  FROM unnest(fns) AS f
  WHERE has_function_privilege('anon', f, 'EXECUTE')
     OR has_function_privilege('authenticated', f, 'EXECUTE')
     OR NOT has_function_privilege('service_role', f, 'EXECUTE');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Function grants are wrong for: %', bad;
  END IF;
END;
$$;

COMMIT;

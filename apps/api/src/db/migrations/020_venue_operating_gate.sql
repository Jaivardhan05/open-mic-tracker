-- Migration: only venues that may operate (approved, active, not suspended;
-- see venue_can_operate in 018) can create or change spots and take requests.
-- Apply manually against Supabase after 019_spot_request_acceptance_history.sql.
-- See specs/admin-venue-management.md (step 3b).
--
-- Enforced with triggers rather than by editing create_show / update_show /
-- apply_to_spot / accept_spot_request: that covers every write path, including
-- direct PostgREST writes under the owner policies (spots_owner_all,
-- venue_shows_owner_all, spot_requests_insert_own), which an API-only check
-- would miss. Each of those functions already catches exceptions and returns
-- { success: false, error }, so the message below reaches the UI as-is.
--
-- What is blocked for a venue that cannot operate:
--   * creating a show (venue_shows INSERT) or a spot pool (spots INSERT);
--   * changing an existing show's date, or a pool's date / size / price, or
--     re-activating a cancelled pool;
--   * a comedian requesting a spot (spot_requests INSERT);
--   * accepting or promoting a request (status -> accepted).
-- Never blocked: cancelling shows/spots/requests, a comedian cancelling their
-- own request, available_spots bookkeeping, swap releases. Nothing existing is
-- deleted or hidden.
--
-- Writes with no request JWT claims at all (the SQL editor, migrations, psql)
-- are exempt so seeding and manual fixes keep working; every PostgREST call,
-- including the API's service-role client, carries claims and is checked.

BEGIN;

CREATE OR REPLACE FUNCTION venue_operating_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producer uuid;
  v_requests boolean := false;
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;

  -- OLD is only unassigned on INSERT, so it is only read inside TG_OP =
  -- 'UPDATE' branches (nested IFs: OR does not guarantee short-circuiting).
  IF TG_TABLE_NAME = 'venue_shows' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.date IS NOT DISTINCT FROM OLD.date THEN
        RETURN NEW;
      END IF;
    END IF;
    v_producer := NEW.venue_producer_id;

  ELSIF TG_TABLE_NAME = 'spots' THEN
    IF TG_OP = 'UPDATE' THEN
      IF (NEW.date, NEW.total_spots, NEW.price) IS NOT DISTINCT FROM (OLD.date, OLD.total_spots, OLD.price)
         AND NOT (OLD.is_cancelled AND NOT NEW.is_cancelled) THEN
        RETURN NEW;
      END IF;
    END IF;
    v_producer := NEW.venue_producer_id;

  ELSIF TG_TABLE_NAME = 'spot_requests' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NOT (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted') THEN
        RETURN NEW;
      END IF;
    END IF;
    SELECT venue_producer_id INTO v_producer FROM spots WHERE id = NEW.spot_id;
    v_requests := true;

  ELSE
    RETURN NEW;
  END IF;

  IF v_producer IS NULL OR NOT venue_can_operate(v_producer) THEN
    IF v_requests THEN
      RAISE EXCEPTION 'This venue is not taking requests right now' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Your venue is not approved to add or change shows right now' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_shows_operating_gate ON venue_shows;
CREATE TRIGGER trg_venue_shows_operating_gate
  BEFORE INSERT OR UPDATE ON venue_shows
  FOR EACH ROW EXECUTE FUNCTION venue_operating_gate();

DROP TRIGGER IF EXISTS trg_spots_operating_gate ON spots;
CREATE TRIGGER trg_spots_operating_gate
  BEFORE INSERT OR UPDATE ON spots
  FOR EACH ROW EXECUTE FUNCTION venue_operating_gate();

DROP TRIGGER IF EXISTS trg_spot_requests_operating_gate ON spot_requests;
CREATE TRIGGER trg_spot_requests_operating_gate
  BEFORE INSERT OR UPDATE ON spot_requests
  FOR EACH ROW EXECUTE FUNCTION venue_operating_gate();

COMMIT;

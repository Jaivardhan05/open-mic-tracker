-- Migration: remember when a spot request was accepted and what state it was
-- cancelled from, so per-venue stats (acceptance rate, cancellations after
-- acceptance) can be derived reliably. Apply manually against Supabase after
-- 018_venue_review_and_suspension.sql. See specs/admin-venue-management.md.
--
-- Why: spot_requests.status is overwritten on cancel and decided_at is
-- overwritten on every transition, so "was this ever accepted?" and "was this
-- cancelled while pending or after acceptance?" cannot be recovered from the
-- existing columns.
--
-- Implemented as a trigger rather than by editing accept_spot_request,
-- comedian_cancel_spot_request, venue_cancel_spot_request, cancel_show and
-- update_show: status changes through all of them (and through manual SQL,
-- and the suspend RPC in migration 021) are recorded without rewriting any of
-- those functions. Purely additive: no existing column, status or function
-- changes meaning.
--
-- History before this migration:
--   * currently accepted requests get accepted_at = decided_at (accurate: it
--     is set at the moment of acceptance and not touched while accepted);
--   * older cancelled requests stay NULL / NULL = "n/a" in the stats.

BEGIN;

ALTER TABLE spot_requests
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_from_status spot_request_status_enum;

-- Runs before the trigger exists; it does not touch status.
UPDATE spot_requests
SET accepted_at = decided_at
WHERE status = 'accepted'
  AND accepted_at IS NULL;

CREATE OR REPLACE FUNCTION spot_requests_track_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- The direct-insert RLS policy (006) lets a comedian insert their own
    -- row, so never trust these two columns from the client.
    NEW.accepted_at := CASE WHEN NEW.status = 'accepted' THEN now() ELSE NULL END;
    NEW.cancelled_from_status := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'accepted' THEN
      -- First acceptance wins: a swap sends an accepted request back to
      -- pending (not a cancellation) and a later re-accept keeps the original.
      NEW.accepted_at := COALESCE(OLD.accepted_at, now());
    ELSIF NEW.status IN ('cancelled_by_comedian', 'cancelled_by_venue') THEN
      NEW.cancelled_from_status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spot_requests_track_status ON spot_requests;
CREATE TRIGGER trg_spot_requests_track_status
  BEFORE INSERT OR UPDATE ON spot_requests
  FOR EACH ROW EXECUTE FUNCTION spot_requests_track_status();

COMMIT;

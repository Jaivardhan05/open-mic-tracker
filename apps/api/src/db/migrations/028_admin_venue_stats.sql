-- Migration: read-only per-venue stats for the admin Page B "Pulse" panel.
-- Apply manually against Supabase after 027_suspend_owner_notice.sql.
-- See specs/admin-venue-management.md (Step 7).
--
-- Purely additive: one new function, no table or column changes, no data
-- written. A venue's activity is keyed by its owner (venue_shows and spots
-- carry venue_producer_id = venues.owner_id; one venue per owner is assumed).
-- The legacy `shows` / `bookings` tables are not part of these stats.
--
-- Acceptance rules (from migration 019, no date needed):
--   * Every cancellation made after 019 has cancelled_from_status set by the
--     trigger, so a cancelled request with cancelled_from_status NULL was
--     cancelled before tracking began: whether it was ever accepted is not
--     knowable. Those are EXCLUDED from the acceptance rate and from the
--     "cancelled after acceptance" split, and counted in `excluded`.
--   * acceptance rate = knowable requests with accepted_at set / knowable.
--   * A swap release (accepted -> pending) is not a cancellation.
--   * Cancellations by venue include those caused by a suspension.

BEGIN;

CREATE OR REPLACE FUNCTION admin_venue_stats(p_venue_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shows integer;
  v_shows_cancelled integer;
  v_total integer;
  v_pending integer;
  v_accepted integer;
  v_waitlisted integer;
  v_by_comedian integer;
  v_by_venue integer;
  v_knowable integer;
  v_ever_accepted integer;
  v_excluded integer;
  v_after_acc_venue integer;
  v_after_acc_comedian integer;
BEGIN
  SELECT owner_id INTO v_owner FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;

  IF v_owner IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'has_owner', false,
      'shows', json_build_object('created', 0, 'cancelled', 0),
      'requests', json_build_object(
        'total', 0, 'pending', 0, 'accepted', 0, 'waitlisted', 0,
        'cancelled_by_comedian', 0, 'cancelled_by_venue', 0
      ),
      'acceptance', json_build_object('knowable', 0, 'ever_accepted', 0, 'excluded', 0),
      'cancelled_after_acceptance', json_build_object('by_venue', 0, 'by_comedian', 0)
    );
  END IF;

  SELECT count(*), count(*) FILTER (WHERE is_cancelled)
  INTO v_shows, v_shows_cancelled
  FROM venue_shows
  WHERE venue_producer_id = v_owner;

  SELECT
    count(*),
    count(*) FILTER (WHERE r.status = 'pending'),
    count(*) FILTER (WHERE r.status = 'accepted'),
    count(*) FILTER (WHERE r.status = 'waitlisted'),
    count(*) FILTER (WHERE r.status = 'cancelled_by_comedian'),
    count(*) FILTER (WHERE r.status = 'cancelled_by_venue'),
    count(*) FILTER (
      WHERE r.status IN ('pending', 'accepted', 'waitlisted')
         OR r.cancelled_from_status IS NOT NULL
    ),
    count(*) FILTER (
      WHERE r.accepted_at IS NOT NULL
        AND (r.status IN ('pending', 'accepted', 'waitlisted')
             OR r.cancelled_from_status IS NOT NULL)
    ),
    count(*) FILTER (
      WHERE r.status IN ('cancelled_by_comedian', 'cancelled_by_venue')
        AND r.cancelled_from_status IS NULL
    ),
    count(*) FILTER (
      WHERE r.status = 'cancelled_by_venue' AND r.cancelled_from_status = 'accepted'
    ),
    count(*) FILTER (
      WHERE r.status = 'cancelled_by_comedian' AND r.cancelled_from_status = 'accepted'
    )
  INTO
    v_total, v_pending, v_accepted, v_waitlisted, v_by_comedian, v_by_venue,
    v_knowable, v_ever_accepted, v_excluded, v_after_acc_venue, v_after_acc_comedian
  FROM spot_requests r
  JOIN spots p ON p.id = r.spot_id
  WHERE p.venue_producer_id = v_owner;

  RETURN json_build_object(
    'success', true,
    'has_owner', true,
    'shows', json_build_object('created', v_shows, 'cancelled', v_shows_cancelled),
    'requests', json_build_object(
      'total', v_total,
      'pending', v_pending,
      'accepted', v_accepted,
      'waitlisted', v_waitlisted,
      'cancelled_by_comedian', v_by_comedian,
      'cancelled_by_venue', v_by_venue
    ),
    'acceptance', json_build_object(
      'knowable', v_knowable,
      'ever_accepted', v_ever_accepted,
      'excluded', v_excluded
    ),
    'cancelled_after_acceptance', json_build_object(
      'by_venue', v_after_acc_venue,
      'by_comedian', v_after_acc_comedian
    )
  );
END;
$$;

-- New functions get EXECUTE for PUBLIC by default: restrict explicitly.
REVOKE ALL ON FUNCTION admin_venue_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_venue_stats(uuid) TO service_role;

COMMIT;

-- After applying, a read-only sanity check in the SQL editor (replace the id):
--   SELECT admin_venue_stats('<venue uuid>');
-- and the permission check, which must fail with 42501 when run as anon via
-- /rest/v1/rpc/admin_venue_stats.

-- Migration: fix get_platform_stats() querying a stale enum value.
-- Apply manually against Supabase after 008_venue_moderation.sql.
--
-- The live user_role enum uses 'venue_producer' (matching the app code and
-- requireRole() checks throughout apps/api/src/index.ts), not 'venue_owner'
-- as originally written in functions.sql. That mismatch made
-- get_platform_stats() throw "invalid input value for enum user_role"
-- on every call, 500-ing GET /api/admin/stats.

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
        WHERE role = 'venue_producer')
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

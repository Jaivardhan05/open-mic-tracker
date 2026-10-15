-- Migration: direct database reads (the anon key) see only venues the public
-- is meant to see, and admins keep full read access to venues.
-- Apply manually against Supabase after 022b and 024.
-- See specs/admin-venue-management.md (step 4b, part 3).
--
-- Why (from the live pg_policies, 2026-10-16):
--   * venues_public_read: (admin_approved AND is_active). It ignores is_hidden
--     and is_suspended, so anyone with the anon key can read hidden and
--     suspended venues over PostgREST, including suspension_reason.
--   * shows_public_read: same gap for the venue it joins to.
--   * spots_public_read and venue_shows_public_read: only `is_cancelled = false`.
--     They never look at the venue, so the spots and shows of pending,
--     rejected, hidden and suspended venues are readable by anyone.
-- The Express API already filters all of this (publicVenueFilters); this closes
-- the same hole for requests that skip the API.
--
-- What changes:
--   1. venues_public_read now also requires is_hidden = false AND
--      is_suspended = false.
--   2. NEW venues_admin_read_all: a user whose users.role is 'admin' can read
--      every venue. It reads the role with an inline EXISTS on users for
--      auth.uid(), not from the JWT or any field the user edits. That is only
--      safe because users.role cannot be changed by a client (022) and cannot
--      be chosen at signup (022b), so apply both first. Needed because
--      AdminProfile reads `venues` with the browser client and the stricter
--      public policy would otherwise hide hidden/suspended rows from admins.
--   3. shows_public_read: the venue must also be not hidden and not suspended.
--   4. spots_public_read and venue_shows_public_read: the producer must own a
--      venue that is approved, active, not hidden and not suspended. Written
--      inline because venue_is_public() is not executable by anon/authenticated
--      (and should stay that way). Spots and venue_shows belong to the owner
--      (venue_producer_id), so the link is venues.owner_id = venue_producer_id.
--
-- Unchanged (not touched, listed so nothing is a surprise):
--   * owners keep full access to their own rows (*_owner_all, venues_owner_*),
--     so a hidden or suspended owner still sees their own venue;
--   * venues_service_role_read_all, and the insert policies;
--   * venues_insert_authenticated and venues_insert_own are duplicates of each
--     other with the same effect. Left for a later tidy-up.
--
-- Checked in the code: the API reads these tables with the anon client only on
-- /api/venues, /api/shows, /api/venues/:id (venue + its legacy shows) and
-- /api/spots (venue ids), all of which already filter to public venues, so
-- their results do not change. Spots and venue_shows are read by the API with
-- the service role. The web reads `venues` directly in three places: signup
-- (insert), login (the owner's own venue, covered by venues_owner_read_own) and
-- AdminProfile (the admin policy above).
--
-- A user who owns two venues would expose their spots while ANY of them is
-- public. Data is one venue per owner today; same assumption as 018/020.
--
-- Atomic self-test at the end: it checks, as anon and as the admin, what a
-- direct read can see, and aborts the whole migration (nothing changes) if a
-- hidden/suspended venue or a non-public venue's spot is still readable by
-- anon, or if the admin cannot see every venue.

BEGIN;

DROP POLICY IF EXISTS "venues_public_read" ON venues;
CREATE POLICY "venues_public_read"
  ON venues FOR SELECT
  TO anon, authenticated
  USING (
    admin_approved = true
    AND is_active = true
    AND is_hidden = false
    AND is_suspended = false
  );

DROP POLICY IF EXISTS "venues_admin_read_all" ON venues;
CREATE POLICY "venues_admin_read_all"
  ON venues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "shows_public_read" ON shows;
CREATE POLICY "shows_public_read"
  ON shows FOR SELECT
  TO anon, authenticated
  USING (
    is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM venues
      WHERE venues.id = shows.venue_id
        AND venues.admin_approved = true
        AND venues.is_active = true
        AND venues.is_hidden = false
        AND venues.is_suspended = false
    )
  );

DROP POLICY IF EXISTS "spots_public_read" ON spots;
CREATE POLICY "spots_public_read"
  ON spots FOR SELECT
  TO anon, authenticated
  USING (
    is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM venues
      WHERE venues.owner_id = spots.venue_producer_id
        AND venues.admin_approved = true
        AND venues.is_active = true
        AND venues.is_hidden = false
        AND venues.is_suspended = false
    )
  );

DROP POLICY IF EXISTS "venue_shows_public_read" ON venue_shows;
CREATE POLICY "venue_shows_public_read"
  ON venue_shows FOR SELECT
  TO anon, authenticated
  USING (
    is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM venues
      WHERE venues.owner_id = venue_shows.venue_producer_id
        AND venues.admin_approved = true
        AND venues.is_active = true
        AND venues.is_hidden = false
        AND venues.is_suspended = false
    )
  );

-- Self-test. Counts are taken as the table owner first, then re-read as anon
-- and as the admin. SET LOCAL ROLE / set_config(..., true) last only for this
-- transaction. Any failure rolls the whole migration back.
DO $$
DECLARE
  v_admin uuid;
  v_all_venues int;
  v_leak int;
  v_seen int;
BEGIN
  SELECT id INTO v_admin FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT count(*) INTO v_all_venues FROM venues;

  SET LOCAL ROLE anon;

  SELECT count(*) INTO v_leak FROM venues WHERE is_hidden OR is_suspended OR NOT admin_approved OR NOT is_active;
  IF v_leak > 0 THEN
    RAISE EXCEPTION 'SELF-TEST FAILED: anon can read % non-public venues', v_leak;
  END IF;

  SELECT count(*) INTO v_leak FROM spots s
  WHERE NOT EXISTS (
    SELECT 1 FROM venues v
    WHERE v.owner_id = s.venue_producer_id AND v.admin_approved AND v.is_active AND NOT v.is_hidden AND NOT v.is_suspended
  );
  -- A subquery above runs under anon's own policies, so it only ever sees
  -- public venues; any spot returned here would belong to a non-public venue.
  IF v_leak > 0 THEN
    RAISE EXCEPTION 'SELF-TEST FAILED: anon can read % spots of non-public venues', v_leak;
  END IF;

  SELECT count(*) INTO v_leak FROM venue_shows s
  WHERE NOT EXISTS (
    SELECT 1 FROM venues v
    WHERE v.owner_id = s.venue_producer_id AND v.admin_approved AND v.is_active AND NOT v.is_hidden AND NOT v.is_suspended
  );
  IF v_leak > 0 THEN
    RAISE EXCEPTION 'SELF-TEST FAILED: anon can read % venue_shows of non-public venues', v_leak;
  END IF;

  RESET ROLE;

  IF v_admin IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_admin)::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_seen FROM venues;
    RESET ROLE;
    IF v_seen <> v_all_venues THEN
      RAISE EXCEPTION 'SELF-TEST FAILED: admin sees % of % venues', v_seen, v_all_venues;
    END IF;
  END IF;
END $$;

COMMIT;

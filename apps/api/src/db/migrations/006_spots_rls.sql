-- Migration: RLS policies for spots + spot_requests.
-- Apply manually against Supabase after 005_spots_and_requests.sql.
-- Mirrors the shows/bookings policy pattern in rls.sql.

ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_requests ENABLE ROW LEVEL SECURITY;

-- Venue producers can manage their own spots
CREATE POLICY "spots_owner_all"
  ON spots FOR ALL
  TO authenticated
  USING (auth.uid() = venue_producer_id)
  WITH CHECK (auth.uid() = venue_producer_id);

-- Anyone can read non-cancelled spots (future browse/apply surfaces)
CREATE POLICY "spots_public_read"
  ON spots FOR SELECT
  TO anon, authenticated
  USING (is_cancelled = false);

-- Comedians can read their own requests
CREATE POLICY "spot_requests_read_own"
  ON spot_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = comedian_id);

-- Venue producers can read requests for their own spots
CREATE POLICY "spot_requests_read_for_own_spots"
  ON spot_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spots
      WHERE spots.id = spot_requests.spot_id
      AND spots.venue_producer_id = auth.uid()
    )
  );

-- Comedians can create requests for themselves only
CREATE POLICY "spot_requests_insert_own"
  ON spot_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = comedian_id);

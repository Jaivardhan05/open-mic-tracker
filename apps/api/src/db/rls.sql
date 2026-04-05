-- Row Level Security Policies
-- Run after functions.sql

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved active venues
CREATE POLICY "venues_public_read"
  ON venues FOR SELECT
  TO anon, authenticated
  USING (
    admin_approved = true
    AND is_active = true
  );

-- Venue owners can read their own venues
-- regardless of approval status
CREATE POLICY "venues_owner_read_own"
  ON venues FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Venue owners can update their own venues
-- but cannot change admin_approved or verified
CREATE POLICY "venues_owner_update_own"
  ON venues FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
  );

-- Authenticated users can insert new venues
-- New venues always start unapproved
CREATE POLICY "venues_insert_authenticated"
  ON venues FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_approved = false
    AND verified = false
    AND auth.uid() = owner_id
  );

-- Anyone can read shows for approved venues
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
    )
  );

-- Venue owners can manage their own shows
CREATE POLICY "shows_owner_all"
  ON shows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.id = shows.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Users can only read their own profile
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
-- but cannot change their role
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
  );

-- Comedians can read their own bookings
CREATE POLICY "bookings_read_own"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = comedian_id);

-- Comedians can create bookings
-- for themselves only
CREATE POLICY "bookings_insert_own"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = comedian_id
  );

-- OpenMic Booking Platform - Database Schema
-- PostgreSQL / Supabase
-- ACID compliant. Run in this order:
-- 1. schema.sql
-- 2. functions.sql
-- 3. rls.sql
-- 4. seed.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('comedian', 'venue_owner', 'admin');

CREATE TYPE spot_type_enum AS ENUM ('busking', 'non_busking');

CREATE TYPE payment_status_enum AS ENUM ('pending', 'confirmed', 'refunded', 'failed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) >= 2),
  email text UNIQUE NOT NULL CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'comedian',
  city text NOT NULL DEFAULT 'Delhi',
  profile_picture text,
  phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{10,15}$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) >= 2),
  address text NOT NULL,
  city text NOT NULL DEFAULT 'Delhi',
  state text NOT NULL DEFAULT 'Delhi',
  country text NOT NULL DEFAULT 'India',
  lat numeric CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng numeric CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  photos text[] NOT NULL DEFAULT '{}',
  description text,
  verified boolean NOT NULL DEFAULT false,
  admin_approved boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time),
  spot_type spot_type_enum NOT NULL,
  total_spots integer NOT NULL CHECK (total_spots > 0 AND total_spots <= 100),
  available_spots integer NOT NULL CHECK (available_spots >= 0),
  charge numeric NOT NULL DEFAULT 0 CHECK (charge >= 0),
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT available_lte_total CHECK (available_spots <= total_spots),
  CONSTRAINT show_not_in_past CHECK (date >= CURRENT_DATE - INTERVAL '1 day')
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comedian_id uuid REFERENCES users(id) ON DELETE SET NULL,
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  slots_booked integer NOT NULL DEFAULT 1 CHECK (slots_booked > 0 AND slots_booked <= 10),
  payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  payment_id text,
  payment_provider text DEFAULT 'razorpay',
  refund_status text,
  booked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_city ON venues(city);

CREATE INDEX idx_venues_admin_approved ON venues(admin_approved)
WHERE admin_approved = false;

CREATE INDEX idx_shows_venue_id ON shows(venue_id);

CREATE INDEX idx_shows_date_time ON shows(date, start_time);

CREATE INDEX idx_shows_spot_type ON shows(spot_type);

CREATE INDEX idx_shows_available ON shows(available_spots)
WHERE available_spots > 0;

CREATE INDEX idx_bookings_show_id ON bookings(show_id);

CREATE INDEX idx_bookings_comedian_id ON bookings(comedian_id);

CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at
  BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: spots + spot_requests tables (venue producer dashboard).
-- Apply manually against Supabase after 004_comedian_cancel_booking_fn.sql.
-- See specs/venue-dashboard.md for the data model and state machine.

CREATE TYPE spot_request_status_enum AS ENUM (
  'pending',
  'accepted',
  'waitlisted',
  'cancelled_by_comedian',
  'cancelled_by_venue'
);

CREATE TABLE spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_producer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time),
  spot_type spot_type_enum NOT NULL,
  total_spots integer NOT NULL CHECK (total_spots > 0 AND total_spots <= 100),
  available_spots integer NOT NULL CHECK (available_spots >= 0),
  price numeric CHECK (price IS NULL OR price >= 0),
  is_cancelled boolean NOT NULL DEFAULT false,
  cancellation_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spot_available_lte_total CHECK (available_spots <= total_spots)
);

CREATE TABLE spot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  comedian_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status spot_request_status_enum NOT NULL DEFAULT 'pending',
  venue_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

-- One active request per (spot, comedian). Cancelled rows are excluded so
-- history is preserved and a comedian can re-apply after cancelling.
CREATE UNIQUE INDEX idx_spot_requests_active_unique
  ON spot_requests (spot_id, comedian_id)
  WHERE status IN ('pending', 'accepted', 'waitlisted');

CREATE INDEX idx_spots_venue_producer_id ON spots(venue_producer_id);

CREATE INDEX idx_spots_date ON spots(date);

CREATE INDEX idx_spot_requests_spot_id ON spot_requests(spot_id);

CREATE INDEX idx_spot_requests_comedian_id ON spot_requests(comedian_id);

CREATE INDEX idx_spot_requests_status ON spot_requests(status);

-- Migration: venue hide/unhide moderation + venue_notices table.
-- Apply manually against Supabase after 007_spot_functions.sql.
-- See specs/admin-dashboard-spec.md for the rationale (hard delete deferred).

ALTER TABLE venues
  ADD COLUMN is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN hidden_reason text;

CREATE TABLE venue_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  venue_name text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_notices_owner_id ON venue_notices(owner_id);

ALTER TABLE venue_notices ENABLE ROW LEVEL SECURITY;

-- Owners can read their own notices. All writes go through
-- SECURITY DEFINER functions invoked by the API's service-role client.
CREATE POLICY "venue_notices_read_own"
  ON venue_notices FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Admin hides a venue: excludes it from comedian-facing listings and
-- notifies the owner why via venue_notices.
CREATE OR REPLACE FUNCTION admin_hide_venue(
  p_venue_id uuid,
  p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue venues%ROWTYPE;
  v_reason text;
BEGIN
  v_reason := NULLIF(trim(p_reason), '');
  IF v_reason IS NULL THEN
    v_reason := 'venue removed by admin';
  END IF;

  UPDATE venues
  SET is_hidden = true,
      hidden_reason = v_reason,
      updated_at = now()
  WHERE id = p_venue_id
  RETURNING * INTO v_venue;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;

  IF v_venue.owner_id IS NOT NULL THEN
    INSERT INTO venue_notices (owner_id, venue_id, venue_name, reason)
    VALUES (v_venue.owner_id, v_venue.id, v_venue.name, v_reason);
  END IF;

  RETURN json_build_object(
    'success', true,
    'venue_id', v_venue.id,
    'owner_id', v_venue.owner_id
  );
END;
$$;

-- Admin reverses a hide. Not punitive, so no notice is sent.
CREATE OR REPLACE FUNCTION admin_unhide_venue(p_venue_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue venues%ROWTYPE;
BEGIN
  UPDATE venues
  SET is_hidden = false,
      hidden_reason = NULL,
      updated_at = now()
  WHERE id = p_venue_id
  RETURNING * INTO v_venue;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venue not found');
  END IF;

  RETURN json_build_object('success', true, 'venue_id', v_venue.id);
END;
$$;

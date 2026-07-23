ALTER TABLE venues
  ADD COLUMN instagram_url text CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
  ADD COLUMN youtube_url text CHECK (youtube_url IS NULL OR youtube_url ~* '^https?://'),
  ADD COLUMN maps_url text CHECK (maps_url IS NULL OR maps_url ~* '^https?://'),
  ADD COLUMN contact_email text CHECK (contact_email IS NULL OR contact_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  ADD COLUMN contact_phone text;

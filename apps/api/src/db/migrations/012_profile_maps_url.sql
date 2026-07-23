ALTER TABLE users
  ADD COLUMN maps_url text CHECK (maps_url IS NULL OR maps_url ~* '^https?://');

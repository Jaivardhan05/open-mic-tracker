ALTER TABLE venues
  DROP COLUMN youtube_url,
  ADD COLUMN x_url text CHECK (x_url IS NULL OR x_url ~* '^https?://');

-- Migration: comedian profile fields (bio + social/contact links)
-- Apply manually against Supabase after schema.sql/functions.sql/rls.sql/seed.sql.
-- See specs/edit-profile-spec.md for the field-editability rationale.

ALTER TABLE users
  ADD COLUMN bio text CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD COLUMN contact_email text CHECK (contact_email IS NULL OR contact_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  ADD COLUMN youtube_url text CHECK (youtube_url IS NULL OR youtube_url ~* '^https?://'),
  ADD COLUMN x_url text CHECK (x_url IS NULL OR x_url ~* '^https?://'),
  ADD COLUMN instagram_url text CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://');

-- Migration: only 'comedian' or 'venue_producer' can be chosen at signup.
-- Apply manually against Supabase after 022_protect_user_role.sql, BEFORE 025.
-- See specs/admin-venue-management.md (step 4b, part 3).
--
-- Why: the live handle_new_user() (read from the database, 2026-10-16) did
--   COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'comedian')
-- raw_user_meta_data is whatever the client passes to supabase.auth.signUp(
-- { options: { data } }), and the anon key that makes that call ships in the
-- web bundle. So anyone could sign up with data.role = 'admin' and get a
-- users row with role = 'admin', which then passes every admin guard. 022
-- cannot stop this: the trigger runs inside the auth service's transaction,
-- which carries no client JWT claims, so 022 treats it as trusted.
-- (No account has used this: the only admins are the owner's own account and
-- the test admin. The check was made on 2026-10-16.)
--
-- Fix: whitelist. 'venue_producer' is honoured (the web signup sends it), every
-- other value, including 'admin', a missing value or a typo, becomes
-- 'comedian'. An invalid value also no longer makes signup fail with a cast
-- error. Everything else in the function is unchanged from the live version.
--
-- Admins are created by hand from now on: promote an existing account in the
-- SQL editor or with the service-role key (UPDATE users SET role = 'admin'),
-- which 022 allows.
--
-- Check after applying (read-only): this must return true.
--   SELECT pg_get_functiondef('public.handle_new_user'::regproc) LIKE '%venue_producer%'
--      AND pg_get_functiondef('public.handle_new_user'::regproc) NOT LIKE '%::user_role,%';

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, name, email, password_hash, role, city)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'supabase_managed',
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'venue_producer' THEN 'venue_producer'::user_role
      ELSE 'comedian'::user_role
    END,
    COALESCE(
      NEW.raw_user_meta_data->>'city',
      'Delhi'
    )
  );
  RETURN NEW;
END;
$function$;

COMMIT;

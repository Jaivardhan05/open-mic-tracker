-- Migration: stop a signed-in user from changing their own users.role.
-- Apply manually against Supabase after 021_venue_suspension.sql.
-- See specs/admin-venue-management.md (step 4b, part 1).
--
-- Why: the users_update_own policy (rls.sql) only checks auth.uid() = id, and
-- the `authenticated` role holds UPDATE on users.role (has_column_privilege is
-- true; verified in the SQL editor). With the anon key plus a normal session,
-- a user can PATCH their own row and set role = 'admin'. The API's
-- requireRole() reads users.role with the service role, so that account would
-- then pass every admin guard. The only trigger on users was the updated_at
-- one; nothing protected the column.
--
-- Same pattern as venues_protect_moderation (018): a request made with an
-- `anon` / `authenticated` JWT cannot change the protected column. Writes with
-- no such JWT role are unaffected:
--   * the API's service-role client,
--   * the SQL editor / migrations,
--   * the auth service's signup trigger (handle_new_user runs inside GoTrue's
--     transaction, which sets no request.jwt.claims).
--
-- Rules for a client JWT:
--   * UPDATE: role must not change.
--   * INSERT (users_insert_own lets a user insert their own row): role must not
--     be 'admin'. Compared as text so it does not depend on the enum labels.
--
-- NOT covered here: handle_new_user itself. If it copies a client-supplied
-- signup metadata role into users.role without a whitelist, a crafted signup
-- could still create an admin. That function's body is not in the repo; it is
-- fixed separately once its source has been read.
--
-- Safe self-test after applying (changes nothing either way: the DO block is
-- atomic, so even if the trigger were missing the UPDATE is rolled back by the
-- exception). "Success" means the role is protected; an error saying NOT
-- PROTECTED means the trigger is not working.
--
--   DO $$
--   BEGIN
--     PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
--     BEGIN
--       UPDATE users SET role = 'admin'
--       WHERE id = (SELECT id FROM users WHERE role::text = 'comedian' LIMIT 1);
--       RAISE EXCEPTION 'NOT PROTECTED: a client JWT changed users.role';
--     EXCEPTION WHEN insufficient_privilege THEN
--       NULL;
--     END;
--   END $$;

BEGIN;

CREATE OR REPLACE FUNCTION users_protect_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );

  IF v_jwt_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::text = 'admin' THEN
      RAISE EXCEPTION 'role cannot be set to admin by the user' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by the user' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Named so it sorts ahead of update_users_updated_at; order does not matter
-- functionally, but a rejected write should fail before anything else runs.
DROP TRIGGER IF EXISTS users_1_protect_role ON users;
CREATE TRIGGER users_1_protect_role
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION users_protect_role();

COMMIT;

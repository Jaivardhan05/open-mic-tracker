-- Migration: the older SECURITY DEFINER functions can no longer be called with
-- the public anon key or a user's login. Only the API (service role) runs them.
-- Apply manually against Supabase after 022b. See specs/admin-venue-management.md
-- (step 4b, part 3).
--
-- Why: these 14 functions are SECURITY DEFINER (they run with the owner's
-- rights and skip RLS) and the live catalog shows EXECUTE is granted to anon
-- (and so to everyone). PostgREST exposes every function in `public` at
-- /rest/v1/rpc/<name>, so anyone holding the anon key from the web bundle could
-- call them directly. Confirmed on 2026-10-15: calling admin_hide_venue with
-- the anon key and a made-up id reached the function ("Venue not found")
-- instead of being refused. admin_hide_venue / admin_unhide_venue (hide or show
-- any venue), book_show_spot / apply_to_spot / the cancel and accept functions
-- (act as any user, because the user id is a parameter) and get_platform_stats
-- are all reachable that way. The newer functions (018, 021) were already
-- revoked and are not in this list.
--
-- Safe because (checked in the code on 2026-10-16):
--   * every one of the API's 17 .rpc( calls goes through supabaseAdmin
--     (service role), which keeps EXECUTE;
--   * apps/web and packages contain no .rpc( call;
--   * no SQL function, trigger or policy in the repo calls any of these 14 as
--     the invoking user.
--
-- Left alone on purpose:
--   * rls_auto_enable(): a Supabase-provided event-trigger helper, not part of
--     this app.
--   * Trigger functions: they never appear in the catalog list used here, and
--     triggers do not need EXECUTE for the invoking role.
--
-- Not covered: functions created in the future get EXECUTE for PUBLIC by
-- default. New migrations should revoke explicitly, as 018 and 021 do.
--
-- Atomic: the list is cast to regprocedure, so a signature that does not exist
-- aborts the whole migration, and the check at the end aborts it if any
-- function is still callable by anon/authenticated or not by service_role.

BEGIN;

DO $$
DECLARE
  fns regprocedure[] := ARRAY[
    'book_show_spot(uuid,uuid,integer)',
    'get_platform_stats()',
    'venue_confirm_booking(uuid)',
    'comedian_decline_booking(uuid,uuid)',
    'comedian_cancel_booking(uuid,uuid)',
    'apply_to_spot(uuid,uuid)',
    'comedian_cancel_spot_request(uuid,uuid)',
    'admin_hide_venue(uuid,text)',
    'admin_unhide_venue(uuid)',
    'venue_cancel_spot_request(uuid,uuid,text)',
    'create_show(uuid,date,time without time zone,time without time zone,integer,numeric,integer,numeric,boolean,numeric)',
    'update_show(uuid,uuid,date,integer,numeric,integer,numeric,boolean,numeric)',
    'cancel_show(uuid,uuid,text)',
    'accept_spot_request(uuid,uuid,text,uuid)'
  ]::regprocedure[];
  fn regprocedure;
  bad text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;

  SELECT string_agg(f::text, ', ') INTO bad
  FROM unnest(fns) AS f
  WHERE has_function_privilege('anon', f, 'EXECUTE')
     OR has_function_privilege('authenticated', f, 'EXECUTE')
     OR NOT has_function_privilege('service_role', f, 'EXECUTE');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'LOCKDOWN FAILED for: %', bad;
  END IF;
END $$;

COMMIT;

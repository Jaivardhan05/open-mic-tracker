-- Migration: close the direct-write path on spot_requests. Apply manually
-- against Supabase after 029_request_price_snapshot_and_cancel_cutoff.sql.
-- See specs/spot-requests-rls-insert-followup.md (option 1) and
-- specs/payments-weekly-billing.md (Step 1).
--
-- The problem (verified live on 2026-11-08): the policy
-- "spot_requests_insert_own" (006) lets any signed-in comedian insert a row
-- for themselves straight through PostgREST with ANY status, including
-- 'accepted'. That is self-acceptance without the venue owner, it skips every
-- check in apply_to_spot(), and it never decrements spots.available_spots.
-- Once weekly billing exists, such a row would also be billable.
--
-- The fix: drop that policy and take INSERT / UPDATE / DELETE (and the other
-- table privileges) away from anon and authenticated. Nothing legitimate
-- depends on them:
--   * the web app never reads or writes spot_requests through the Supabase
--     client (checked: no reference outside /api/spot-requests calls);
--   * the API only touches the table with the service-role client, which has
--     its own privileges and bypasses RLS;
--   * every SECURITY DEFINER function here (apply_to_spot, accept_spot_request,
--     comedian_cancel_spot_request, update_show, cancel_show, the suspend RPC)
--     runs as the function owner, not as the caller;
--   * triggers run with the privileges of the statement that fired them.
-- SELECT stays for authenticated, because the two read policies from 006
-- (own requests, requests for own spots) still apply and are harmless.
-- Comedians and owners lose no feature.
--
-- Safe to apply at any time and to re-run; independent of the API and web
-- code (it changes nothing they call). Aborts if the result is not exactly as
-- intended. Writes with no JWT claims (the SQL editor) are unaffected.

BEGIN;

DROP POLICY IF EXISTS "spot_requests_insert_own" ON spot_requests;

REVOKE ALL ON TABLE spot_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE spot_requests TO authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon', 'spot_requests', 'SELECT')
     OR has_table_privilege('anon', 'spot_requests', 'INSERT')
     OR has_table_privilege('anon', 'spot_requests', 'UPDATE')
     OR has_table_privilege('anon', 'spot_requests', 'DELETE') THEN
    RAISE EXCEPTION 'anon still has privileges on spot_requests';
  END IF;

  IF has_table_privilege('authenticated', 'spot_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'spot_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'spot_requests', 'DELETE')
     OR has_table_privilege('authenticated', 'spot_requests', 'TRUNCATE') THEN
    RAISE EXCEPTION 'authenticated can still write to spot_requests';
  END IF;

  IF NOT has_table_privilege('authenticated', 'spot_requests', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on spot_requests';
  END IF;

  IF NOT (has_table_privilege('service_role', 'spot_requests', 'SELECT')
          AND has_table_privilege('service_role', 'spot_requests', 'INSERT')
          AND has_table_privilege('service_role', 'spot_requests', 'UPDATE')
          AND has_table_privilege('service_role', 'spot_requests', 'DELETE')) THEN
    RAISE EXCEPTION 'service_role lost privileges on spot_requests';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'spot_requests' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'a write policy still exists on spot_requests';
  END IF;
END;
$$;

COMMIT;

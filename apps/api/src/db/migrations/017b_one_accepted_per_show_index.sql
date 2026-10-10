-- Migration: DB-level guarantee of at most one 'accepted' spot_request per
-- (show, comedian). HOLD: do not apply until 017a is applied AND the duplicate
-- report below returns zero rows (or the agreed cleanup has been run).
--
-- Step 1 - report (read-only). Run this on its own first:
--
--   SELECT show_id, comedian_id, count(*) AS accepted_count,
--          array_agg(spot_id ORDER BY decided_at) AS spot_ids,
--          array_agg(id ORDER BY decided_at) AS request_ids,
--          array_agg(decided_at ORDER BY decided_at) AS decided_ats
--   FROM spot_requests
--   WHERE status = 'accepted'
--   GROUP BY show_id, comedian_id
--   HAVING count(*) > 1;
--
-- Step 2 - this migration. It refuses to run (and changes nothing) while
-- duplicates exist, instead of silently picking a winner.

DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT 1 FROM spot_requests
    WHERE status = 'accepted'
    GROUP BY show_id, comedian_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION '% (show, comedian) pair(s) already have more than one accepted request. Resolve them first; no changes were made.', v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spot_requests_one_accepted_per_show
  ON spot_requests (show_id, comedian_id)
  WHERE status = 'accepted';

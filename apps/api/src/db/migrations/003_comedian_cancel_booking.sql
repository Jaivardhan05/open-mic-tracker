-- Migration: comedian-initiated cancellation of a not-yet-confirmed booking.
-- Apply manually against Supabase after 002_booking_status.sql.
-- See specs/dashboard-spec.md for the status model and transitions.
--
-- Run the ALTER TYPE statement and verify it commits before applying the
-- rest of this file — Postgres does not allow a new enum value to be used
-- in the same transaction that added it.

ALTER TYPE booking_status_enum ADD VALUE 'cancelled_by_comedian';

-- Custom SQL migration file, put your code below! --

-- Backfill resolved_at / closed_at for existing rows. These columns were never
-- written before this change, so resolved/closed tickets have NULL timestamps.
-- Use updated_at as the best-available approximation of when they reached that state.
-- Idempotent (guarded by IS NULL); a no-op on a fresh/empty database.

UPDATE "tickets" SET "resolved_at" = "updated_at"
  WHERE "status" IN ('resolved', 'closed') AND "resolved_at" IS NULL;

UPDATE "tickets" SET "closed_at" = "updated_at"
  WHERE "status" = 'closed' AND "closed_at" IS NULL;

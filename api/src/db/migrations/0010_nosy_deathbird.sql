-- 'pending' and 'rejected' moved into the 0002 CREATE TYPE so the one-transaction
-- v2 migration runner never uses an uncommitted enum value (55P04). This file is
-- kept so the journal order stays stable; re-runs are no-ops.
SELECT 1;

-- Read-only checks for #321: did production run migrations 0031 and 0032, and does closing a
-- round queue and deliver round.closed and credit.awarded?
--
--   psql "$PROD_DATABASE_URL" -f scripts/verify-prod-migrations.sql
--
-- Every query is a SELECT. Each block says what a good result looks like.

\echo '1. migrations applied (expect rows for 0031 and 0032, newest last)'
SELECT id, created_at
FROM drizzle.__drizzle_migrations
ORDER BY id DESC
LIMIT 5;

\echo '2. feedback_suggestions exists (expect 1 row)'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'feedback_suggestions';

\echo '3. new activity columns exist (expect 2 rows)'
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('rounds', 'closed_activity_event_id'),
    ('round_credits', 'activity_event_id')
  );

\echo '4. outbox by event type and status (round.closed and credit.awarded should be delivered, failed should be 0 or explained)'
SELECT event_type, status, count(*) AS rows, max(created_at) AS latest
FROM activity_outbox
GROUP BY event_type, status
ORDER BY event_type, status;

\echo '5. closed rounds with no recorded activity event (expect none from after the deploy)'
SELECT id, title, closed_at
FROM rounds
WHERE status = 'closed' AND closed_activity_event_id IS NULL
ORDER BY closed_at DESC
LIMIT 10;

\echo '6. credits with no recorded activity event (expect none from after the deploy)'
SELECT id, round_id, created_at
FROM round_credits
WHERE activity_event_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

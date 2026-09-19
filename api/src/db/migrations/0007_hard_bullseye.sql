CREATE TABLE "project_round_counters" (
	"project_slug" text PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "project_round_number" integer;
--> statement-breakpoint
WITH numbered AS (
	SELECT id, row_number() OVER (PARTITION BY project_slug ORDER BY created_at, id) AS rn
	FROM rounds
)
UPDATE rounds
SET project_round_number = numbered.rn
FROM numbered
WHERE rounds.id = numbered.id;
--> statement-breakpoint
INSERT INTO project_round_counters (project_slug, last_number)
SELECT project_slug, count(*) FROM rounds GROUP BY project_slug
ON CONFLICT (project_slug) DO UPDATE SET last_number = excluded.last_number;
--> statement-breakpoint
ALTER TABLE "rounds" ALTER COLUMN "project_round_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_project_round_number_idx" ON "rounds" USING btree ("project_slug","project_round_number");

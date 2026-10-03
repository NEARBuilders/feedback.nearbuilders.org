CREATE TYPE "public"."project_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_org_id" text,
	"nearbuilders_project_id" text,
	"status" "project_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "project_record_id" uuid;--> statement-breakpoint
-- Backfill: one project per existing round slug. Pre-org rounds have no owning
-- org, so owner_org_id stays NULL for backfilled projects. A project is
-- pending if any of its rounds still awaits review, else approved if any round
-- went live, else rejected.
INSERT INTO "projects" ("slug", "name", "nearbuilders_project_id", "status", "approved_at", "rejected_at", "rejection_reason", "created_at", "updated_at")
SELECT
	r."project_slug",
	r."project_slug",
	max(r."project_id"),
	CASE
		WHEN bool_or(r."status" = 'pending') THEN 'pending'
		WHEN bool_or(r."status" IN ('open', 'closed')) THEN 'approved'
		ELSE 'rejected'
	END::"project_status",
	CASE
		WHEN bool_or(r."status" = 'pending') THEN NULL
		WHEN bool_or(r."status" IN ('open', 'closed')) THEN min(r."created_at")
		ELSE NULL
	END,
	CASE
		WHEN bool_or(r."status" IN ('pending', 'open', 'closed')) THEN NULL
		ELSE max(r."rejected_at")
	END,
	CASE
		WHEN bool_or(r."status" IN ('pending', 'open', 'closed')) THEN NULL
		ELSE (array_agg(r."rejection_reason" ORDER BY r."rejected_at" DESC NULLS LAST))[1]
	END,
	min(r."created_at"),
	now()
FROM "rounds" r
GROUP BY r."project_slug";--> statement-breakpoint
UPDATE "rounds" SET "project_record_id" = p."id" FROM "projects" p WHERE p."slug" = "rounds"."project_slug";--> statement-breakpoint
ALTER TABLE "rounds" ALTER COLUMN "project_record_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_owner_org_id_idx" ON "projects" USING btree ("owner_org_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_project_record_id_projects_id_fk" FOREIGN KEY ("project_record_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_project_record_id_idx" ON "rounds" USING btree ("project_record_id");
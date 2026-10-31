ALTER TABLE "rounds" ADD COLUMN "organization_id" text;--> statement-breakpoint
CREATE INDEX "rounds_organization_id_idx" ON "rounds" USING btree ("organization_id");
--> statement-breakpoint
UPDATE "rounds" SET "organization_id" = "projects"."owner_org_id" FROM "projects" WHERE "rounds"."project_record_id" = "projects"."id" AND "projects"."owner_org_id" IS NOT NULL;

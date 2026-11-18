CREATE TYPE "public"."access_grant_permission" AS ENUM('manage', 'read');--> statement-breakpoint
CREATE TYPE "public"."access_grant_principal" AS ENUM('org', 'team');--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"principal_type" "access_grant_principal" NOT NULL,
	"principal_id" text NOT NULL,
	"permission" "access_grant_permission" NOT NULL,
	"org_slug" text,
	"added_by_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_grants_project_principal_idx" ON "access_grants" USING btree ("project_id","principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "access_grants_principal_idx" ON "access_grants" USING btree ("principal_type","principal_id");
ALTER TABLE "projects" ADD COLUMN "contact" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "verified_by_account_id" text;
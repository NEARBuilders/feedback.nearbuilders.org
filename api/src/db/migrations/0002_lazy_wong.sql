CREATE TYPE "public"."round_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_account_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"formats" text[] NOT NULL,
	"repo_url" text,
	"status" "round_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "rounds_owner_account_id_idx" ON "rounds" USING btree ("owner_account_id");--> statement-breakpoint
CREATE INDEX "rounds_status_idx" ON "rounds" USING btree ("status");
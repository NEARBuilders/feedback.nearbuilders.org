CREATE TYPE "public"."round_feedback_author_type" AS ENUM('near', 'anonymous', 'agent');--> statement-breakpoint
ALTER TABLE "round_feedback" ALTER COLUMN "author_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "round_feedback" ADD COLUMN "author_type" "round_feedback_author_type" DEFAULT 'near' NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "allow_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "round_feedback_created_idx" ON "round_feedback" USING btree ("created_at");
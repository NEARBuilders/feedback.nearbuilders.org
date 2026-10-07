CREATE TYPE "public"."feedback_note_role" AS ENUM('owner', 'tester');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'feedback_resolved';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'feedback_dismissed';--> statement-breakpoint
CREATE TABLE "feedback_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"author_account_id" text NOT NULL,
	"role" "feedback_note_role" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "feedback_id" uuid;--> statement-breakpoint
ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_feedback_id_round_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."round_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_notes_feedback_created_idx" ON "feedback_notes" USING btree ("feedback_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_feedback_id_round_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."round_feedback"("id") ON DELETE set null ON UPDATE no action;
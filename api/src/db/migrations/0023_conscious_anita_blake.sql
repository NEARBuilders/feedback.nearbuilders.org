CREATE TYPE "public"."activity_outbox_operation" AS ENUM('emit', 'retract');--> statement-breakpoint
CREATE TYPE "public"."activity_outbox_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "activity_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" "activity_outbox_operation" NOT NULL,
	"event_type" text,
	"actor" text,
	"payload" jsonb,
	"target_event_id" text,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"subject_kind" text,
	"subject_id" uuid,
	"status" "activity_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "round_feedback" ADD COLUMN "accepted_activity_event_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_outbox_idempotency_key_idx" ON "activity_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "activity_outbox_due_idx" ON "activity_outbox" USING btree ("status","next_attempt_at");
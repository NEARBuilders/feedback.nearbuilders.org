ALTER TABLE "round_credits" ADD COLUMN "activity_event_id" text;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "closed_activity_event_id" text;
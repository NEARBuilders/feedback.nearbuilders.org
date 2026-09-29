ALTER TABLE "rounds" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "rejected_at" timestamp with time zone;

ALTER TABLE "rounds" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "legion_only" boolean DEFAULT false NOT NULL;
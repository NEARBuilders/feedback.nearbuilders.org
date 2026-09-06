CREATE TYPE "public"."round_feedback_format" AS ENUM('written', 'recorded');--> statement-breakpoint
CREATE TABLE "round_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"author_account_id" text NOT NULL,
	"format" "round_feedback_format" NOT NULL,
	"body" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round_feedback" ADD CONSTRAINT "round_feedback_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "round_feedback_round_created_idx" ON "round_feedback" USING btree ("round_id","created_at");
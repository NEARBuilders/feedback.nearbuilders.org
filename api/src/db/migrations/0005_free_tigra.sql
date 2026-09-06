CREATE TABLE "round_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"builder_account_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"round_title" text NOT NULL,
	"contributed_meaningfully" boolean DEFAULT false NOT NULL,
	"summary" text,
	"written_count" integer DEFAULT 0 NOT NULL,
	"recorded_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round_credits" ADD CONSTRAINT "round_credits_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "round_credits_round_builder_idx" ON "round_credits" USING btree ("round_id","builder_account_id");--> statement-breakpoint
CREATE INDEX "round_credits_builder_idx" ON "round_credits" USING btree ("builder_account_id");
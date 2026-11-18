CREATE TABLE "feedback_suggestions" (
	"feedback_id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"status" "round_feedback_status",
	"star" boolean DEFAULT false NOT NULL,
	"note" text,
	"suggested_by_key_id" text,
	"organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_suggestions" ADD CONSTRAINT "feedback_suggestions_feedback_id_round_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."round_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_suggestions" ADD CONSTRAINT "feedback_suggestions_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_suggestions_round_idx" ON "feedback_suggestions" USING btree ("round_id");
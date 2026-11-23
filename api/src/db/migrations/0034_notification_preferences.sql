CREATE TABLE "notification_preferences" (
	"account_id" text PRIMARY KEY NOT NULL,
	"feedback_updates" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

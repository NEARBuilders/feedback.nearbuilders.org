CREATE TABLE "storage_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"uploader_account_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"owner_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "storage_assets_key_unique" ON "storage_assets" USING btree ("key");
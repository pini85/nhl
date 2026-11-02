CREATE TABLE IF NOT EXISTS "arcade_knocks" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"offer" text NOT NULL,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arcade_rooms" ADD COLUMN IF NOT EXISTS "host_key" text;
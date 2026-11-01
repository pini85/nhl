CREATE TABLE IF NOT EXISTS "arcade_rooms" (
	"code" text PRIMARY KEY NOT NULL,
	"offer" text NOT NULL,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "discord_posts" (
	"night_key" text PRIMARY KEY NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);

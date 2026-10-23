CREATE TABLE "opponent_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"crest_asset_id" text,
	"division" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"otl" integer DEFAULT 0 NOT NULL,
	"season_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"members" jsonb,
	"profile" jsonb,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"normalized" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"club_id" integer,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "opponent_snapshots_club_idx" ON "opponent_snapshots" USING btree ("club_id","taken_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "scout_requests_pending_uq" ON "scout_requests" USING btree ("normalized") WHERE status = 'pending';
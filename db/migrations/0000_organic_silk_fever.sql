CREATE TABLE "club_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"club_id" integer NOT NULL,
	"division" integer NOT NULL,
	"season_results" jsonb NOT NULL,
	"recent_results" jsonb NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"otl" integer NOT NULL,
	"titles" integer NOT NULL,
	"promotions" integer NOT NULL,
	"holds" integer NOT NULL,
	"relegations" integer NOT NULL,
	"ranking_points" integer NOT NULL,
	"seasons" integer NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"new_matches" integer DEFAULT 0 NOT NULL,
	"recovered_matches" integer DEFAULT 0 NOT NULL,
	"summary_matches" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "match_clubs" (
	"match_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"name" text NOT NULL,
	"crest_asset_id" text,
	"division" integer NOT NULL,
	"score" integer NOT NULL,
	"shots" integer NOT NULL,
	"hits" integer NOT NULL,
	"pim" integer NOT NULL,
	"pass_attempts" integer NOT NULL,
	"pass_completions" integer NOT NULL,
	"ppg" integer NOT NULL,
	"ppo" integer NOT NULL,
	"faceoff_wins" integer NOT NULL,
	"faceoff_losses" integer NOT NULL,
	"toa_seconds" integer NOT NULL,
	"member_string" text,
	CONSTRAINT "match_clubs_match_id_club_id_pk" PRIMARY KEY("match_id","club_id")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" text NOT NULL,
	"club_id" integer NOT NULL,
	"ea_player_id" text NOT NULL,
	"player_name" text NOT NULL,
	"position" text NOT NULL,
	"is_guest" boolean NOT NULL,
	"dnf" boolean NOT NULL,
	"platform" text,
	"player_level" integer NOT NULL,
	"toi_seconds" integer NOT NULL,
	"goals" integer NOT NULL,
	"assists" integer NOT NULL,
	"plus_minus" integer NOT NULL,
	"shots" integer NOT NULL,
	"shot_attempts" integer NOT NULL,
	"hits" integer NOT NULL,
	"pim" integer NOT NULL,
	"ppg" integer NOT NULL,
	"shg" integer NOT NULL,
	"gwg" integer NOT NULL,
	"blocked_shots" integer NOT NULL,
	"takeaways" integer NOT NULL,
	"giveaways" integer NOT NULL,
	"interceptions" integer NOT NULL,
	"pass_attempts" integer NOT NULL,
	"passes" integer NOT NULL,
	"faceoff_wins" integer NOT NULL,
	"faceoff_losses" integer NOT NULL,
	"possession_seconds" integer NOT NULL,
	"penalties_drawn" integer NOT NULL,
	"deflections" integer NOT NULL,
	"saucer_passes" integer NOT NULL,
	"gl_saves" integer NOT NULL,
	"gl_shots" integer NOT NULL,
	"gl_ga" integer NOT NULL,
	"gl_save_pct" real NOT NULL,
	"gl_poke_checks" integer NOT NULL,
	"rating_offense" real NOT NULL,
	"rating_defense" real NOT NULL,
	"rating_teamplay" real NOT NULL,
	CONSTRAINT "match_players_match_id_ea_player_id_pk" PRIMARY KEY("match_id","ea_player_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"match_type" text NOT NULL,
	"source" text NOT NULL,
	"opponent_club_id" integer NOT NULL,
	"goals_for" integer NOT NULL,
	"goals_against" integer NOT NULL,
	"outcome" text NOT NULL,
	"overtime" boolean NOT NULL,
	"dnf" text NOT NULL,
	"result_code" text,
	"timestamp_estimated" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "match_players_player_idx" ON "match_players" USING btree ("ea_player_id");--> statement-breakpoint
CREATE INDEX "matches_played_at_idx" ON "matches" USING btree ("played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "matches_opponent_idx" ON "matches" USING btree ("opponent_club_id");
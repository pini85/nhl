ALTER TABLE "extra_player_stats" ADD COLUMN "blocked_shots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "extra_player_stats" ADD COLUMN "interceptions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "extra_player_stats" ADD COLUMN "pass_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "extra_player_stats" ADD COLUMN "passes" integer DEFAULT 0 NOT NULL;
CREATE TABLE "extra_player_stats" (
	"ea_player_id" text PRIMARY KEY NOT NULL,
	"player_name" text NOT NULL,
	"covers_from" timestamp with time zone NOT NULL,
	"gp" integer NOT NULL,
	"goals" integer NOT NULL,
	"assists" integer NOT NULL,
	"plus_minus" integer NOT NULL,
	"shots" integer NOT NULL,
	"hits" integer NOT NULL,
	"pim" integer NOT NULL,
	"ppg" integer NOT NULL,
	"shg" integer NOT NULL,
	"takeaways" integer NOT NULL,
	"giveaways" integer NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "opponent_name" text;
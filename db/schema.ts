import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { RecentResult, RosterMember } from "@/lib/ea/normalize";
import type { OpponentProfile } from "@/lib/opponents/profile";

export const matches = pgTable(
  "matches",
  {
    matchId: text("match_id").primaryKey(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    matchType: text("match_type").notNull(),
    source: text("source", { enum: ["full", "summary"] }).notNull(),
    opponentClubId: integer("opponent_club_id").notNull(),
    // Name for games without a box score (no match_clubs row), e.g. entered from the in-game history.
    opponentName: text("opponent_name"),
    goalsFor: integer("goals_for").notNull(),
    goalsAgainst: integer("goals_against").notNull(),
    outcome: text("outcome", { enum: ["W", "L"] }).notNull(),
    overtime: boolean("overtime").notNull(),
    dnf: text("dnf", { enum: ["none", "opponent_quit", "we_quit"] }).notNull(),
    resultCode: text("result_code"),
    timestampEstimated: boolean("timestamp_estimated").notNull().default(false),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matches_played_at_idx").on(t.playedAt.desc()), index("matches_opponent_idx").on(t.opponentClubId)],
);

export const matchClubs = pgTable(
  "match_clubs",
  {
    matchId: text("match_id").notNull(),
    clubId: integer("club_id").notNull(),
    name: text("name").notNull(),
    crestAssetId: text("crest_asset_id"),
    division: integer("division").notNull(),
    score: integer("score").notNull(),
    shots: integer("shots").notNull(),
    hits: integer("hits").notNull(),
    pim: integer("pim").notNull(),
    passAttempts: integer("pass_attempts").notNull(),
    passCompletions: integer("pass_completions").notNull(),
    ppg: integer("ppg").notNull(),
    ppo: integer("ppo").notNull(),
    faceoffWins: integer("faceoff_wins").notNull(),
    faceoffLosses: integer("faceoff_losses").notNull(),
    toaSeconds: integer("toa_seconds").notNull(),
    memberString: text("member_string"),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.clubId] })],
);

const stat = (name: string) => integer(name).notNull();

export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: text("match_id").notNull(),
    clubId: integer("club_id").notNull(),
    eaPlayerId: text("ea_player_id").notNull(),
    playerName: text("player_name").notNull(),
    position: text("position").notNull(),
    isGuest: boolean("is_guest").notNull(),
    dnf: boolean("dnf").notNull(),
    platform: text("platform"),
    playerLevel: stat("player_level"),
    toiSeconds: stat("toi_seconds"),
    goals: stat("goals"),
    assists: stat("assists"),
    plusMinus: stat("plus_minus"),
    shots: stat("shots"),
    shotAttempts: stat("shot_attempts"),
    hits: stat("hits"),
    pim: stat("pim"),
    ppg: stat("ppg"),
    shg: stat("shg"),
    gwg: stat("gwg"),
    blockedShots: stat("blocked_shots"),
    takeaways: stat("takeaways"),
    giveaways: stat("giveaways"),
    interceptions: stat("interceptions"),
    passAttempts: stat("pass_attempts"),
    passes: stat("passes"),
    faceoffWins: stat("faceoff_wins"),
    faceoffLosses: stat("faceoff_losses"),
    possessionSeconds: stat("possession_seconds"),
    penaltiesDrawn: stat("penalties_drawn"),
    deflections: stat("deflections"),
    saucerPasses: stat("saucer_passes"),
    glSaves: stat("gl_saves"),
    glShots: stat("gl_shots"),
    glGa: stat("gl_ga"),
    glSavePct: real("gl_save_pct").notNull(),
    glPokeChecks: stat("gl_poke_checks"),
    ratingOffense: real("rating_offense").notNull(),
    ratingDefense: real("rating_defense").notNull(),
    ratingTeamplay: real("rating_teamplay").notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.eaPlayerId] }), index("match_players_player_idx").on(t.eaPlayerId)],
);

// Player stats from games without a box score, taken from the in-game club totals
// (season total minus what our stored box scores already add up to).
export const extraPlayerStats = pgTable("extra_player_stats", {
  eaPlayerId: text("ea_player_id").primaryKey(),
  playerName: text("player_name").notNull(),
  // Earliest game these stats cover; date filters only count them when the range reaches back this far.
  coversFrom: timestamp("covers_from", { withTimezone: true }).notNull(),
  gp: stat("gp"),
  goals: stat("goals"),
  assists: stat("assists"),
  plusMinus: stat("plus_minus"),
  shots: stat("shots"),
  hits: stat("hits"),
  pim: stat("pim"),
  ppg: stat("ppg"),
  shg: stat("shg"),
  takeaways: stat("takeaways"),
  giveaways: stat("giveaways"),
  blockedShots: integer("blocked_shots").notNull().default(0),
  interceptions: integer("interceptions").notNull().default(0),
  passAttempts: integer("pass_attempts").notNull().default(0),
  passes: integer("passes").notNull().default(0),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubSnapshots = pgTable("club_snapshots", {
  id: serial("id").primaryKey(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
  clubId: integer("club_id").notNull(),
  division: integer("division").notNull(),
  seasonResults: jsonb("season_results").$type<string[]>().notNull(),
  recentResults: jsonb("recent_results").$type<RecentResult[]>().notNull(),
  wins: integer("wins").notNull(),
  losses: integer("losses").notNull(),
  otl: integer("otl").notNull(),
  titles: integer("titles").notNull(),
  promotions: integer("promotions").notNull(),
  holds: integer("holds").notNull(),
  relegations: integer("relegations").notNull(),
  rankingPoints: integer("ranking_points").notNull(),
  seasons: integer("seasons").notNull(),
  members: jsonb("members").$type<RosterMember[]>(),
  raw: jsonb("raw").notNull(),
});

export const collectorRuns = pgTable("collector_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger", { enum: ["cron", "visit", "manual", "seed"] }).notNull(),
  status: text("status", { enum: ["running", "ok", "partial", "error"] }).notNull().default("running"),
  newMatches: integer("new_matches").notNull().default(0),
  recoveredMatches: integer("recovered_matches").notNull().default(0),
  summaryMatches: integer("summary_matches").notNull().default(0),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  error: text("error"),
});

export const opponentSnapshots = pgTable(
  "opponent_snapshots",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    name: text("name").notNull(),
    crestAssetId: text("crest_asset_id"),
    division: integer("division"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    otl: integer("otl").notNull().default(0),
    seasonResults: jsonb("season_results").$type<string[]>().notNull().default([]),
    members: jsonb("members").$type<RosterMember[]>(),
    profile: jsonb("profile").$type<OpponentProfile>(),
    raw: jsonb("raw").notNull(),
  },
  (t) => [index("opponent_snapshots_club_idx").on(t.clubId, t.takenAt.desc())],
);

export const scoutRequests = pgTable(
  "scout_requests",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    normalized: text("normalized").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status", { enum: ["pending", "done", "not_found", "error"] }).notNull().default("pending"),
    clubId: integer("club_id"),
    // How many clubs EA's search returned; the others are saved too, so a local search finds them.
    results: integer("results"),
    attempts: integer("attempts").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("scout_requests_pending_uq").on(t.normalized).where(sql`status = 'pending'`)],
);

// Game nights already posted to Discord, so each night is announced once.
export const discordPosts = pgTable("discord_posts", {
  nightKey: text("night_key").primaryKey(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
});

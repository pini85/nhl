import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { clubSnapshots, collectorRuns, matchClubs, matches, matchPlayers } from "@/db/schema";
import type { MatchClubRow, MatchPlayerRow, MatchRow, NormalizedMatch } from "@/lib/ea/normalize";

// Compile-time check: normalizer rows fit the tables.
type Fits<Row, Insert> = Row extends Insert ? true : never;
const _rowsFit: [
  Fits<MatchRow, typeof matches.$inferInsert>,
  Fits<MatchClubRow, typeof matchClubs.$inferInsert>,
  Fits<MatchPlayerRow, typeof matchPlayers.$inferInsert>,
] = [true, true, true];
void _rowsFit;

export type RunTrigger = "cron" | "visit" | "manual" | "seed";
export type RunResult = {
  status: "ok" | "partial" | "error";
  newMatches: number;
  recoveredMatches: number;
  summaryMatches: number;
  warnings: string[];
  error?: string;
};
export type NewSnapshot = typeof clubSnapshots.$inferInsert;

// Children first, match row last: a stored match row means the game is complete.
export async function insertNormalizedMatch(db: Db, n: NormalizedMatch): Promise<boolean> {
  if (n.players.length) await db.insert(matchPlayers).values(n.players).onConflictDoNothing();
  if (n.clubs.length) await db.insert(matchClubs).values(n.clubs).onConflictDoNothing();
  return insertMatchRow(db, n.match);
}

export async function insertMatchRow(db: Db, row: MatchRow): Promise<boolean> {
  const inserted = await db
    .insert(matches)
    .values(row)
    .onConflictDoNothing()
    .returning({ matchId: matches.matchId });
  return inserted.length > 0;
}

export async function existingMatchIds(db: Db, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db.select({ matchId: matches.matchId }).from(matches).where(inArray(matches.matchId, ids));
  return new Set(rows.map((r) => r.matchId));
}

export type StoredResult = {
  matchId: string;
  playedAt: Date;
  opponentClubId: number;
  goalsFor: number;
  goalsAgainst: number;
  source: "full" | "summary";
};

export async function recentStoredResults(db: Db, limit: number): Promise<StoredResult[]> {
  return db
    .select({
      matchId: matches.matchId,
      playedAt: matches.playedAt,
      opponentClubId: matches.opponentClubId,
      goalsFor: matches.goalsFor,
      goalsAgainst: matches.goalsAgainst,
      source: matches.source,
    })
    .from(matches)
    .orderBy(desc(matches.playedAt))
    .limit(limit);
}

export async function newestStoredPlayedAt(db: Db): Promise<Date | null> {
  const [row] = await db
    .select({ playedAt: matches.playedAt })
    .from(matches)
    .orderBy(desc(matches.playedAt))
    .limit(1);
  return row?.playedAt ?? null;
}

export async function insertSnapshot(db: Db, row: NewSnapshot): Promise<void> {
  await db.insert(clubSnapshots).values(row);
}

export async function startRun(db: Db, trigger: RunTrigger): Promise<number> {
  const [row] = await db.insert(collectorRuns).values({ trigger }).returning({ id: collectorRuns.id });
  return row.id;
}

export async function finishRun(db: Db, id: number, result: RunResult): Promise<void> {
  await db
    .update(collectorRuns)
    .set({
      finishedAt: new Date(),
      status: result.status,
      newMatches: result.newMatches,
      recoveredMatches: result.recoveredMatches,
      summaryMatches: result.summaryMatches,
      warnings: result.warnings,
      error: result.error ?? null,
    })
    .where(eq(collectorRuns.id, id));
}

// Start time of the latest run (optionally only successful ones).
export async function lastRunAt(db: Db, status?: "ok"): Promise<Date | null> {
  const q = db.select({ startedAt: collectorRuns.startedAt }).from(collectorRuns);
  const [row] = await (status ? q.where(eq(collectorRuns.status, status)) : q)
    .orderBy(desc(collectorRuns.startedAt), desc(collectorRuns.id))
    .limit(1);
  return row?.startedAt ?? null;
}

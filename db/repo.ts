import { and, asc, desc, eq, gt, inArray, max, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { clubSnapshots, collectorRuns, matchClubs, matches, matchPlayers, opponentSnapshots, scoutRequests } from "@/db/schema";
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

export async function recentStoredResults(db: Db, limit: number, matchType?: string): Promise<StoredResult[]> {
  const q = db
    .select({
      matchId: matches.matchId,
      playedAt: matches.playedAt,
      opponentClubId: matches.opponentClubId,
      goalsFor: matches.goalsFor,
      goalsAgainst: matches.goalsAgainst,
      source: matches.source,
    })
    .from(matches);
  return (matchType ? q.where(eq(matches.matchType, matchType)) : q).orderBy(desc(matches.playedAt)).limit(limit);
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

// ---- Opponents ----

export type ScoutRequest = typeof scoutRequests.$inferSelect;

export async function pendingScoutRequests(db: Db, limit: number): Promise<ScoutRequest[]> {
  return db.select().from(scoutRequests).where(eq(scoutRequests.status, "pending")).orderBy(asc(scoutRequests.requestedAt)).limit(limit);
}

export async function markScoutRequest(
  db: Db,
  id: number,
  status: "done" | "not_found" | "error",
  clubId?: number,
  results?: number,
): Promise<void> {
  await db
    .update(scoutRequests)
    .set({ status, clubId: clubId ?? null, results: results ?? null, processedAt: new Date() })
    .where(eq(scoutRequests.id, id));
}

// Which of these clubs already have a scouting snapshot.
export async function clubsWithSnapshots(db: Db, clubIds: number[]): Promise<Set<number>> {
  if (!clubIds.length) return new Set();
  const rows = await db
    .selectDistinct({ clubId: opponentSnapshots.clubId })
    .from(opponentSnapshots)
    .where(inArray(opponentSnapshots.clubId, clubIds));
  return new Set(rows.map((r) => r.clubId));
}

const DAY = 86_400_000;

// Opponents we played in the last 14 days without a snapshot from the last 6 hours, most recent first.
export async function staleRecentOpponents(db: Db, now: Date, limit: number): Promise<number[]> {
  if (limit <= 0) return [];
  const fresh = db
    .selectDistinct({ clubId: opponentSnapshots.clubId })
    .from(opponentSnapshots)
    .where(gt(opponentSnapshots.takenAt, new Date(now.getTime() - 6 * 3_600_000)));
  const rows = await db
    .select({ clubId: matches.opponentClubId, last: max(matches.playedAt) })
    .from(matches)
    .where(and(gt(matches.playedAt, new Date(now.getTime() - 14 * DAY)), notInArray(matches.opponentClubId, fresh)))
    .groupBy(matches.opponentClubId)
    .orderBy(desc(max(matches.playedAt)))
    .limit(limit);
  return rows.map((r) => r.clubId);
}

export async function insertOpponentSnapshot(db: Db, row: typeof opponentSnapshots.$inferInsert): Promise<void> {
  await db.insert(opponentSnapshots).values(row);
}

export async function knownClubName(db: Db, clubId: number): Promise<string | null> {
  const [row] = await db.select({ name: matchClubs.name }).from(matchClubs).where(eq(matchClubs.clubId, clubId)).limit(1);
  return row?.name ?? null;
}

// Counts a failed attempt; returns the new attempt count.
export async function bumpScoutAttempt(db: Db, id: number): Promise<number> {
  const [row] = await db
    .update(scoutRequests)
    .set({ attempts: sql`${scoutRequests.attempts} + 1` })
    .where(eq(scoutRequests.id, id))
    .returning({ attempts: scoutRequests.attempts });
  return row?.attempts ?? 0;
}

// Keep only the newest `keep` snapshots per club so storage stays small.
export async function pruneOpponentSnapshots(db: Db, clubId: number, keep = 3): Promise<void> {
  const rows = await db
    .select({ id: opponentSnapshots.id })
    .from(opponentSnapshots)
    .where(eq(opponentSnapshots.clubId, clubId))
    .orderBy(desc(opponentSnapshots.takenAt), desc(opponentSnapshots.id));
  const old = rows.slice(keep).map((r) => r.id);
  if (old.length) await db.delete(opponentSnapshots).where(inArray(opponentSnapshots.id, old));
}

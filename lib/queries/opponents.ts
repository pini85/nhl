import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { matchClubs, matches, matchPlayers, opponentSnapshots, scoutRequests } from "@/db/schema";
import type { MatchClubRow } from "@/lib/ea/normalize";
import type { PlayerLine } from "@/lib/stats/types";

export type OpponentSnapshot = typeof opponentSnapshots.$inferSelect;

export async function latestOpponentSnapshot(db: Db, clubId: number): Promise<OpponentSnapshot | null> {
  const [row] = await db
    .select()
    .from(opponentSnapshots)
    .where(eq(opponentSnapshots.clubId, clubId))
    .orderBy(desc(opponentSnapshots.takenAt), desc(opponentSnapshots.id))
    .limit(1);
  return row ?? null;
}

export async function scoutedClubs(
  db: Db,
): Promise<{ clubId: number; name: string; crestAssetId: string | null; division: number | null; takenAt: Date }[]> {
  return db
    .selectDistinctOn([opponentSnapshots.clubId], {
      clubId: opponentSnapshots.clubId,
      name: opponentSnapshots.name,
      crestAssetId: opponentSnapshots.crestAssetId,
      division: opponentSnapshots.division,
      takenAt: opponentSnapshots.takenAt,
    })
    .from(opponentSnapshots)
    .orderBy(opponentSnapshots.clubId, desc(opponentSnapshots.takenAt));
}

export async function allClubRows(db: Db): Promise<MatchClubRow[]> {
  return db.select().from(matchClubs);
}

export async function opponentLines(db: Db, clubId: number): Promise<PlayerLine[]> {
  return db
    .select({ line: matchPlayers })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.matchId, matchPlayers.matchId))
    .where(eq(matchPlayers.clubId, clubId))
    .orderBy(asc(matches.playedAt))
    .then((rows) => rows.map((r) => r.line));
}

const MAX_QUERY = 40;

export async function createScoutRequest(db: Db, query: string): Promise<"created" | "exists" | "invalid"> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_QUERY) return "invalid";
  const inserted = await db
    .insert(scoutRequests)
    .values({ query: trimmed, normalized: trimmed.toLowerCase() })
    .onConflictDoNothing()
    .returning({ id: scoutRequests.id });
  return inserted.length ? "created" : "exists";
}

export async function recentScoutRequests(db: Db, limit = 20) {
  return db.select().from(scoutRequests).orderBy(desc(scoutRequests.requestedAt), desc(scoutRequests.id)).limit(limit);
}

import { asc, count, desc, eq } from "drizzle-orm";
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
const MAX_PENDING = 20;

// Queue a club for the collector. Input is cleaned and the queue is capped,
// because this is reachable by anyone through a public Server Action.
export async function createScoutRequest(
  db: Db,
  query: string,
  clubId?: number,
): Promise<"created" | "exists" | "invalid" | "busy"> {
  if (/[\u0000-\u001f\u007f]/.test(query)) return "invalid";
  const cleaned = query.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > MAX_QUERY || !/[\p{L}\p{N}]/u.test(cleaned)) return "invalid";
  if (clubId !== undefined && (!Number.isInteger(clubId) || clubId <= 0)) return "invalid";

  const [{ pending }] = await db
    .select({ pending: count() })
    .from(scoutRequests)
    .where(eq(scoutRequests.status, "pending"));
  if (pending >= MAX_PENDING) return "busy";

  const inserted = await db
    .insert(scoutRequests)
    .values({ query: cleaned, normalized: cleaned.toLowerCase(), clubId: clubId ?? null })
    .onConflictDoNothing()
    .returning({ id: scoutRequests.id });
  return inserted.length ? "created" : "exists";
}

export async function recentScoutRequests(db: Db, limit = 20) {
  return db.select().from(scoutRequests).orderBy(desc(scoutRequests.requestedAt), desc(scoutRequests.id)).limit(limit);
}

// Removes a request from the list (and cancels it if it's still waiting).
export async function deleteScoutRequest(db: Db, id: number): Promise<boolean> {
  const rows = await db.delete(scoutRequests).where(eq(scoutRequests.id, id)).returning({ id: scoutRequests.id });
  return rows.length > 0;
}

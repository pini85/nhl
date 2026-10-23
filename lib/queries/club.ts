import { and, asc, desc, eq, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { clubSnapshots, matchClubs, matches, matchPlayers } from "@/db/schema";
import { CLUB_ID } from "@/lib/config";
import type { MatchClubRow } from "@/lib/ea/normalize";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type Snapshot = typeof clubSnapshots.$inferSelect;

export async function latestSnapshot(db: Db): Promise<Snapshot | null> {
  const [row] = await db.select().from(clubSnapshots).orderBy(desc(clubSnapshots.takenAt), desc(clubSnapshots.id)).limit(1);
  if (!row || row.members) return row ?? null;
  // The roster call can fail on a run; keep showing the last roster we know.
  const [withRoster] = await db
    .select({ members: clubSnapshots.members })
    .from(clubSnapshots)
    .where(isNotNull(clubSnapshots.members))
    .orderBy(desc(clubSnapshots.takenAt), desc(clubSnapshots.id))
    .limit(1);
  return { ...row, members: withRoster?.members ?? null };
}

const gameColumns = {
  matchId: matches.matchId,
  playedAt: matches.playedAt,
  opponentClubId: matches.opponentClubId,
  opponentName: matchClubs.name,
  goalsFor: matches.goalsFor,
  goalsAgainst: matches.goalsAgainst,
  outcome: matches.outcome,
  overtime: matches.overtime,
  dnf: matches.dnf,
  source: matches.source,
  matchType: matches.matchType,
};

function gamesQuery(db: Db) {
  return db
    .select(gameColumns)
    .from(matches)
    .leftJoin(matchClubs, and(eq(matchClubs.matchId, matches.matchId), eq(matchClubs.clubId, matches.opponentClubId)));
}

export async function allGames(db: Db): Promise<GameLite[]> {
  return gamesQuery(db).orderBy(desc(matches.playedAt));
}

// Oldest game first, so code that keeps the "last seen" name shows the current gamertag.
function linesQuery(db: Db) {
  return db
    .select(getTableColumns(matchPlayers))
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.matchId, matchPlayers.matchId));
}

export async function ourPlayerLines(db: Db): Promise<PlayerLine[]> {
  return linesQuery(db).where(eq(matchPlayers.clubId, CLUB_ID)).orderBy(asc(matches.playedAt));
}

export async function matchDetail(
  db: Db,
  matchId: string,
): Promise<{ game: GameLite; clubs: MatchClubRow[]; lines: PlayerLine[] } | null> {
  const [game] = await gamesQuery(db).where(eq(matches.matchId, matchId)).limit(1);
  if (!game) return null;
  const clubs = await db.select().from(matchClubs).where(eq(matchClubs.matchId, matchId));
  const lines = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  return { game, clubs, lines };
}

export async function playerDetail(
  db: Db,
  eaPlayerId: string,
): Promise<{ lines: PlayerLine[]; games: GameLite[] } | null> {
  const lines = await linesQuery(db)
    .where(and(eq(matchPlayers.eaPlayerId, eaPlayerId), eq(matchPlayers.clubId, CLUB_ID)))
    .orderBy(asc(matches.playedAt));
  if (!lines.length) return null;
  const games = await gamesQuery(db)
    .where(inArray(matches.matchId, lines.map((l) => l.matchId)))
    .orderBy(desc(matches.playedAt));
  return { lines, games };
}

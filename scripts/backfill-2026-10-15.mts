// One-off import of games EA's API no longer serves (Oct 15–20, 2026), typed in from
// in-game screenshots: the club's match history and its season totals per player.
// Safe to re-run: games are inserted once, extra stats are recomputed and upserted.
//   node --env-file=.env.local --import tsx scripts/backfill-2026-10-15.mts
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { extraPlayerStats, matches, matchPlayers } from "@/db/schema";
import { CLUB_ID } from "@/lib/config";

const db = getDb();

// In-game times are shown in UTC+3; stored here as UTC.
type Game = { at: string; clubId: number; name: string; gf: number; ga: number; dnf?: "opponent_quit" | "we_quit" };
const GAMES: Game[] = [
  { at: "2026-10-15T19:42:49Z", clubId: 23343, name: "Russian Rockets DTM", gf: 0, ga: 5 },
  { at: "2026-10-15T20:12:34Z", clubId: 35445, name: "HK Bricks", gf: 8, ga: 1 },
  { at: "2026-10-15T20:41:03Z", clubId: 1765, name: "GREED", gf: 2, ga: 4 },
  { at: "2026-10-15T21:07:44Z", clubId: 3592, name: "CSKA MOSCOW HK", gf: 5, ga: 1, dnf: "opponent_quit" },
  { at: "2026-10-15T21:10:37Z", clubId: 35445, name: "HK Bricks", gf: 3, ga: 0, dnf: "opponent_quit" },
  { at: "2026-10-15T21:42:54Z", clubId: 4897, name: "Coventry Vikings", gf: 9, ga: 4 },
  { at: "2026-10-18T19:22:51Z", clubId: 1623, name: "ISOJOKI", gf: 2, ga: 5 },
  { at: "2026-10-18T19:27:02Z", clubId: 16103, name: "Shadow skulls", gf: 0, ga: 3, dnf: "we_quit" }, // "DISC" after 0:37
  { at: "2026-10-18T19:51:34Z", clubId: 3394, name: "EV Duisburg", gf: 0, ga: 4 },
  { at: "2026-10-18T20:13:34Z", clubId: 2109, name: "MIGHTY BANDITS", gf: 0, ga: 3 },
];

// The collector stored the Old Boys win as score-only with an estimated time on the wrong night.
const OLD_BOYS = { matchId: "summary-1974-1792756800-6", at: "2026-10-20T20:29:58Z", name: "Old Boys" };

// In-game club totals per player after the Oct 22 night (20 games).
const SEASON_THROUGH = new Date("2026-10-23T00:00:00Z");
const COVERS_FROM = new Date(GAMES[0].at);
type Totals = { gp: number; goals: number; assists: number; plusMinus: number; shots: number; hits: number; pim: number; ppg: number; shg: number; takeaways: number; giveaways: number };
const SEASON: Record<string, { name: string } & Totals> = {
  "802564056": { name: "Popomasta-SMB", gp: 14, goals: 2, assists: 4, plusMinus: -1, shots: 15, hits: 11, pim: 4, ppg: 0, shg: 0, takeaways: 45, giveaways: 35 },
  "197708949": { name: "mike_v_75", gp: 19, goals: 8, assists: 15, plusMinus: 8, shots: 42, hits: 67, pim: 14, ppg: 0, shg: 0, takeaways: 50, giveaways: 65 },
  "828785353": { name: "ThePooker", gp: 20, goals: 16, assists: 21, plusMinus: 5, shots: 60, hits: 28, pim: 4, ppg: 1, shg: 1, takeaways: 49, giveaways: 83 },
  "1273735466": { name: "puck_control", gp: 20, goals: 23, assists: 24, plusMinus: 5, shots: 63, hits: 1, pim: 14, ppg: 5, shg: 1, takeaways: 49, giveaways: 135 },
};

let inserted = 0;
for (const g of GAMES) {
  const playedAt = new Date(g.at);
  const rows = await db
    .insert(matches)
    .values({
      matchId: `manual-${g.clubId}-${playedAt.getTime() / 1000}`,
      playedAt,
      matchType: "gameType5",
      source: "summary",
      opponentClubId: g.clubId,
      opponentName: g.name,
      goalsFor: g.gf,
      goalsAgainst: g.ga,
      outcome: g.gf > g.ga ? "W" : "L",
      overtime: false,
      dnf: g.dnf ?? "none",
      resultCode: null,
      timestampEstimated: false,
      raw: { source: "in-game match history screenshot" },
    })
    .onConflictDoNothing()
    .returning({ id: matches.matchId });
  inserted += rows.length;
}
console.log(`games inserted: ${inserted} of ${GAMES.length}`);

const fixed = await db
  .update(matches)
  .set({ playedAt: new Date(OLD_BOYS.at), timestampEstimated: false, opponentName: OLD_BOYS.name })
  .where(eq(matches.matchId, OLD_BOYS.matchId))
  .returning({ id: matches.matchId });
console.log(`Old Boys fixed: ${fixed.length}`);

// Extra = season total minus what our stored box scores (before the cutoff) already add up to.
const stored = await db
  .select({
    id: matchPlayers.eaPlayerId,
    gp: sql<number>`count(*)::int`,
    goals: sql<number>`sum(${matchPlayers.goals})::int`,
    assists: sql<number>`sum(${matchPlayers.assists})::int`,
    plusMinus: sql<number>`sum(${matchPlayers.plusMinus})::int`,
    shots: sql<number>`sum(${matchPlayers.shots})::int`,
    hits: sql<number>`sum(${matchPlayers.hits})::int`,
    pim: sql<number>`sum(${matchPlayers.pim})::int`,
    ppg: sql<number>`sum(${matchPlayers.ppg})::int`,
    shg: sql<number>`sum(${matchPlayers.shg})::int`,
    takeaways: sql<number>`sum(${matchPlayers.takeaways})::int`,
    giveaways: sql<number>`sum(${matchPlayers.giveaways})::int`,
  })
  .from(matchPlayers)
  .innerJoin(matches, eq(matches.matchId, matchPlayers.matchId))
  .where(and(eq(matchPlayers.clubId, CLUB_ID), lt(matches.playedAt, SEASON_THROUGH)))
  .groupBy(matchPlayers.eaPlayerId);
const storedById = new Map(stored.map((s) => [s.id, s]));

for (const [id, { name, ...season }] of Object.entries(SEASON)) {
  const have = storedById.get(id);
  const extra = Object.fromEntries(
    Object.entries(season).map(([k, v]) => [k, v - ((have?.[k as keyof Totals] as number | undefined) ?? 0)]),
  ) as Totals;
  for (const [k, v] of Object.entries(extra)) {
    if (v < 0 && k !== "plusMinus") throw new Error(`${name}: stored ${k} exceeds the season total`);
  }
  const row = { playerName: name, coversFrom: COVERS_FROM, ...extra, note: "in-game club totals through 2026-10-22", updatedAt: new Date() };
  await db.insert(extraPlayerStats).values({ eaPlayerId: id, ...row }).onConflictDoUpdate({ target: extraPlayerStats.eaPlayerId, set: row });
  console.log(name, extra);
}

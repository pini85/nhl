import type { RosterMember } from "@/lib/ea/normalize";
import { playerTotals } from "@/lib/stats/players";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

// Data for the 3D Galaxy tab: small and serializable, built once on the server.

export type GalaxyGame = {
  id: string;
  t: number; // played at, ms
  gf: number;
  ga: number;
  win: boolean;
  ot: boolean;
  opp: string | null;
  who: number[]; // indexes into `players` of those who played (empty for games without a box score)
};

export type GalaxyPos = "F" | "D" | "G";

export type GalaxyPlayer = {
  id: string;
  name: string;
  pos: GalaxyPos;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  hits: number;
  shots: number;
  plusMinus: number;
};

export type GalaxyLink = { a: string; b: string; gp: number; wins: number };

export type GalaxyData = { games: GalaxyGame[]; players: GalaxyPlayer[]; links: GalaxyLink[] };

const FORWARD = new Set(["center", "leftWing", "rightWing"]);

/** Games oldest → newest; club regulars (no guests, most games first); pairs with `minTogether`+ full games together. */
export function galaxyData(
  lines: PlayerLine[],
  games: GameLite[],
  roster: RosterMember[] | null,
  ourClubId: number,
  extras: ExtraStats[] = [],
  { maxPlayers = 30, minTogether = 2 } = {},
): GalaxyData {
  const sortedGames = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const outGames: GalaxyGame[] = sortedGames.map((g) => ({
    id: g.matchId,
    t: g.playedAt.getTime(),
    gf: g.goalsFor,
    ga: g.goalsAgainst,
    win: g.outcome === "W",
    ot: g.overtime,
    opp: g.opponentName,
    who: [],
  }));

  const { skaters, goalies } = playerTotals(lines, games, roster, ourClubId, extras);
  const byId = new Map<string, GalaxyPlayer>();
  for (const s of skaters) {
    if (s.badge === "guest") continue;
    let f = 0;
    let d = 0;
    for (const [p, n] of Object.entries(s.positions)) {
      if (FORWARD.has(p)) f += n;
      else if (p === "defenseMen") d += n;
    }
    byId.set(s.eaPlayerId, {
      id: s.eaPlayerId,
      name: s.name,
      pos: d > f ? "D" : "F",
      gp: s.gp,
      goals: s.goals,
      assists: s.assists,
      points: s.points,
      hits: s.hits,
      shots: s.shots,
      plusMinus: s.plusMinus,
    });
  }
  for (const g of goalies) {
    if (g.badge === "guest") continue;
    const s = byId.get(g.eaPlayerId);
    if (!s) {
      byId.set(g.eaPlayerId, { id: g.eaPlayerId, name: g.name, pos: "G", gp: g.gp, goals: 0, assists: 0, points: 0, hits: 0, shots: 0, plusMinus: 0 });
    } else {
      if (g.gp > s.gp) s.pos = "G";
      s.gp += g.gp;
    }
  }
  const players = [...byId.values()].sort((a, b) => b.gp - a.gp || b.points - a.points || a.name.localeCompare(b.name)).slice(0, maxPlayers);
  const keep = new Set(players.map((p) => p.id));
  const index = new Map(players.map((p, i) => [p.id, i]));
  const gameIndex = new Map(outGames.map((g, i) => [g.id, i]));
  for (const l of lines) {
    const p = index.get(l.eaPlayerId);
    const g = gameIndex.get(l.matchId);
    if (l.clubId !== ourClubId || p === undefined || g === undefined) continue;
    if (!outGames[g].who.includes(p)) outGames[g].who.push(p);
  }
  for (const g of outGames) g.who.sort((a, b) => a - b);

  // Who played together, full games only (summary games have no line-up).
  const full = new Map(games.filter((g) => g.source === "full").map((g) => [g.matchId, g.outcome === "W"]));
  const byMatch = new Map<string, Set<string>>();
  for (const l of lines) {
    if (l.clubId !== ourClubId || !keep.has(l.eaPlayerId) || !full.has(l.matchId)) continue;
    const set = byMatch.get(l.matchId) ?? new Set<string>();
    set.add(l.eaPlayerId);
    byMatch.set(l.matchId, set);
  }
  const pairs = new Map<string, GalaxyLink>();
  for (const [matchId, set] of byMatch) {
    const ids = [...set].sort();
    const win = full.get(matchId)!;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        const p = pairs.get(key) ?? { a: ids[i], b: ids[j], gp: 0, wins: 0 };
        p.gp++;
        if (win) p.wins++;
        pairs.set(key, p);
      }
    }
  }
  const links = [...pairs.values()].filter((p) => p.gp >= minTogether).sort((x, y) => y.gp - x.gp || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  return { games: outGames, players, links };
}

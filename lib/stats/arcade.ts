import type { RosterMember } from "@/lib/ea/normalize";
import { headToHead } from "@/lib/stats/opponents";
import { playerTotals } from "@/lib/stats/players";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

// Data for the Arcade tab: both teams, ratings from real numbers, and the Revenge Tour order.
// Small and serializable, built once on the server.

export type Ratings = { skate: number; shot: number; pass: number; hit: number }; // 60–99

export type ArcadeSkater = {
  id: string;
  name: string;
  number: number;
  pos: "F" | "D";
  r: Ratings;
  ovr: number;
  gp: number;
  goals: number;
  assists: number;
  hits: number;
};

export type ArcadeGoalie = { id: string; name: string; number: number; save: number; gp: number; svPct: number };

export type ArcadeOpponent = {
  clubId: number;
  name: string;
  abbr: string;
  color: string;
  gp: number;
  wins: number; // ours
  losses: number;
  gf: number;
  ga: number;
  last: { gf: number; ga: number; win: boolean; t: number };
  skaters: ArcadeSkater[]; // exactly 3
  goalie: ArcadeGoalie;
  difficulty: number; // 0 (we own them) … 1 (nightmare)
  revenge: boolean; // they have a winning or even record against us
};

export type ArcadeData = {
  skaters: ArcadeSkater[];
  goalies: ArcadeGoalie[];
  opponents: ArcadeOpponent[]; // most played first
  tour: number[]; // revenge clubs, gentlest first, the real nemesis last
};

const FORWARD = new Set(["center", "leftWing", "rightWing"]);
const OPP_COLORS = ["#ff3d6e", "#ff8a4c", "#b67cff", "#3dffa0", "#ffd23d", "#ff5cd6", "#9cff3d", "#ff6b3d"];
const MIN = 62;
const SPAN = 35;

/** Deterministic small hash, so numbers and colours stay the same between visits. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const jersey = (id: string) => 2 + (hash(id) % 97);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function abbreviation(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return (words[0] ?? "OPP").slice(0, 3).toUpperCase();
}

/**
 * Turns raw per-player values into 62–97 by rank within the group. Small samples are pulled
 * toward the group average first, so one lucky game doesn't make a superstar.
 */
export function rate(values: { v: number; gp: number }[]): number[] {
  if (!values.length) return [];
  const mean = values.reduce((s, x) => s + x.v, 0) / values.length;
  const shrunk = values.map((x) => mean + (x.v - mean) * (x.gp / (x.gp + 3)));
  const sorted = [...shrunk].sort((a, b) => a - b);
  return shrunk.map((v) => {
    if (values.length === 1) return MIN + SPAN / 2;
    const lo = sorted.indexOf(v);
    const hi = sorted.lastIndexOf(v);
    return Math.round(MIN + SPAN * ((lo + hi) / 2 / (sorted.length - 1)));
  });
}

type Agg = {
  id: string;
  name: string;
  gp: number;
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  takeaways: number;
  interceptions: number;
  passes: number;
  passAttempts: number;
  f: number;
  d: number;
};

function rateSkaters(list: Agg[]): ArcadeSkater[] {
  const per = (x: Agg, n: number) => (x.gp ? n / x.gp : 0);
  const shot = rate(list.map((x) => ({ v: per(x, x.goals) * (0.5 + (x.shots ? x.goals / x.shots : 0)), gp: x.gp })));
  const passPct = rate(list.map((x) => ({ v: x.passAttempts ? x.passes / x.passAttempts : 0, gp: x.passAttempts ? x.gp : 0 })));
  const assists = rate(list.map((x) => ({ v: per(x, x.assists), gp: x.gp })));
  const hit = rate(list.map((x) => ({ v: per(x, x.hits), gp: x.gp })));
  const skate = rate(list.map((x) => ({ v: per(x, x.goals + x.assists) + per(x, x.takeaways) * 0.3 + per(x, x.interceptions) * 0.2, gp: x.gp })));
  return list.map((x, i) => {
    const r = { skate: skate[i], shot: shot[i], pass: Math.round((passPct[i] + assists[i]) / 2), hit: hit[i] };
    return {
      id: x.id,
      name: x.name,
      number: jersey(x.id),
      pos: x.d > x.f ? "D" : "F",
      r,
      ovr: Math.round((r.skate + r.shot + r.pass + r.hit) / 4),
      gp: x.gp,
      goals: x.goals,
      assists: x.assists,
      hits: x.hits,
    };
  });
}

function rateGoalies(list: { id: string; name: string; gp: number; saves: number; shots: number }[]): ArcadeGoalie[] {
  const save = rate(list.map((g) => ({ v: g.shots ? g.saves / g.shots : 0.7, gp: g.gp })));
  return list.map((g, i) => ({ id: g.id, name: g.name, number: [1, 29, 30, 31, 33, 35, 40, 70][hash(g.id) % 8], save: save[i], gp: g.gp, svPct: g.shots ? g.saves / g.shots : 0 }));
}

function aggregate(lines: PlayerLine[]): { skaters: Agg[]; goalies: { id: string; name: string; gp: number; saves: number; shots: number }[] } {
  const sk = new Map<string, Agg>();
  const gl = new Map<string, { id: string; name: string; gp: number; saves: number; shots: number }>();
  for (const l of lines) {
    if (l.position === "goalie") {
      const g = gl.get(l.eaPlayerId) ?? { id: l.eaPlayerId, name: l.playerName, gp: 0, saves: 0, shots: 0 };
      g.name = l.playerName;
      g.gp++;
      g.saves += l.glSaves;
      g.shots += l.glShots;
      gl.set(l.eaPlayerId, g);
      continue;
    }
    const s = sk.get(l.eaPlayerId) ?? { id: l.eaPlayerId, name: l.playerName, gp: 0, goals: 0, assists: 0, shots: 0, hits: 0, takeaways: 0, interceptions: 0, passes: 0, passAttempts: 0, f: 0, d: 0 };
    s.name = l.playerName;
    s.gp++;
    s.goals += l.goals;
    s.assists += l.assists;
    s.shots += l.shots;
    s.hits += l.hits;
    s.takeaways += l.takeaways;
    s.interceptions += l.interceptions;
    s.passes += l.passes;
    s.passAttempts += l.passAttempts;
    if (FORWARD.has(l.position)) s.f++;
    else if (l.position === "defenseMen") s.d++;
    sk.set(l.eaPlayerId, s);
  }
  const byGp = <T extends { gp: number; name: string }>(a: T, b: T) => b.gp - a.gp || a.name.localeCompare(b.name);
  return { skaters: [...sk.values()].sort(byGp), goalies: [...gl.values()].sort(byGp) };
}

/** A filler player for clubs we have no box score for (or too few players). */
function callUp(abbr: string, k: number, level: number): ArcadeSkater {
  const v = Math.round(MIN + SPAN * (0.3 + 0.5 * level));
  return { id: `${abbr}-${k}`, name: `${abbr} #${[9, 17, 44][k] ?? k + 2}`, number: [9, 17, 44][k] ?? k + 2, pos: k === 2 ? "D" : "F", r: { skate: v, shot: v, pass: v, hit: v }, ovr: v, gp: 0, goals: 0, assists: 0, hits: 0 };
}

/**
 * @param lines our club's player lines
 * @param oppLines player lines of the other club in our own games (any club id but ours)
 */
export function arcadeData(
  lines: PlayerLine[],
  games: GameLite[],
  roster: RosterMember[] | null,
  ourClubId: number,
  extras: ExtraStats[] = [],
  oppLines: PlayerLine[] = [],
  { maxSkaters = 14 } = {},
): ArcadeData {
  // Our side: the same totals as Leaders (box scores + extra stats), regulars only.
  const { skaters, goalies } = playerTotals(lines, games, roster, ourClubId, extras);
  const regulars = skaters.filter((s) => s.badge !== "guest" && s.gp > 0);
  const ours: Agg[] = regulars.map((s) => {
    let f = 0;
    let d = 0;
    for (const [p, n] of Object.entries(s.positions)) {
      if (FORWARD.has(p)) f += n;
      else if (p === "defenseMen") d += n;
    }
    return { id: s.eaPlayerId, name: s.name, gp: s.gp, goals: s.goals, assists: s.assists, shots: s.shots, hits: s.hits, takeaways: s.takeaways, interceptions: s.interceptions, passes: s.passes, passAttempts: s.passAttempts, f, d };
  });
  const ourSkaters = rateSkaters(ours)
    .sort((a, b) => b.gp - a.gp || b.ovr - a.ovr || a.name.localeCompare(b.name))
    .slice(0, maxSkaters);
  const ourGoalies = rateGoalies(
    goalies.filter((g) => g.badge !== "guest").map((g) => ({ id: g.eaPlayerId, name: g.name, gp: g.gp, saves: g.saves, shots: g.shotsAgainst })),
  ).sort((a, b) => b.gp - a.gp || b.save - a.save);
  if (!ourGoalies.length) ourGoalies.push({ id: "call-up-g", name: "Call-up goalie", number: 30, save: 76, gp: 0, svPct: 0 });

  // Their side: every opponent player rated against all opponent players, so levels compare across clubs.
  const gameClub = new Map(games.map((g) => [g.matchId, g.opponentClubId]));
  const theirs = oppLines.filter((l) => l.clubId !== ourClubId && gameClub.get(l.matchId) === l.clubId);
  const byClub = new Map<number, PlayerLine[]>();
  for (const l of theirs) byClub.set(l.clubId, [...(byClub.get(l.clubId) ?? []), l]);
  const perClub = [...byClub.entries()].map(([clubId, ls]) => ({ clubId, ...aggregate(ls) }));
  const allSk = perClub.flatMap((c) => c.skaters.map((s) => ({ clubId: c.clubId, s })));
  const allGl = perClub.flatMap((c) => c.goalies.map((g) => ({ clubId: c.clubId, g })));
  const ratedSk = rateSkaters(allSk.map((x) => x.s));
  const ratedGl = rateGoalies(allGl.map((x) => x.g));

  const opponents: ArcadeOpponent[] = headToHead(games)
    .map((h) => {
      const name = h.name ?? `Club ${h.clubId}`;
      const abbr = abbreviation(name);
      const pain = (h.losses - h.wins) / h.gp;
      const margin = (h.goalsAgainst - h.goalsFor) / h.gp;
      const difficulty = clamp01(0.5 + 0.25 * pain + 0.06 * margin);
      const sk = ratedSk.filter((_, i) => allSk[i].clubId === h.clubId).slice(0, 3);
      while (sk.length < 3) sk.push(callUp(abbr, sk.length, difficulty));
      const gl = ratedGl.find((_, i) => allGl[i].clubId === h.clubId);
      const lv = Math.round(MIN + SPAN * (0.3 + 0.5 * difficulty));
      const last = h.games[0];
      return {
        clubId: h.clubId,
        name,
        abbr,
        color: OPP_COLORS[hash(name) % OPP_COLORS.length],
        gp: h.gp,
        wins: h.wins,
        losses: h.losses,
        gf: h.goalsFor,
        ga: h.goalsAgainst,
        last: { gf: last.goalsFor, ga: last.goalsAgainst, win: last.outcome === "W", t: last.playedAt.getTime() },
        skaters: sk,
        goalie: gl ?? { id: `${abbr}-g`, name: `${abbr} #1`, number: 1, save: lv, gp: 0, svPct: 0 },
        difficulty,
        revenge: h.losses >= h.wins,
      };
    })
    .sort((a, b) => b.gp - a.gp || b.last.t - a.last.t);

  const tour = opponents
    .filter((o) => o.revenge)
    .sort((a, b) => a.difficulty - b.difficulty || a.gp - b.gp || a.name.localeCompare(b.name))
    .map((o) => o.clubId);

  return { skaters: ourSkaters, goalies: ourGoalies, opponents, tour };
}

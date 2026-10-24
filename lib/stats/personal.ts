// Personal stats for the Me tab, the Home card and the extras on every player page.
import { MILESTONE_STEPS, type MilestoneStat } from "@/lib/stats/moments";
import { groupGameNights } from "@/lib/stats/nights";
import { PLAYER_RECORDS, type RecordItem } from "@/lib/stats/records";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

const DAY = 86_400_000;
const RECENT_DAYS = 60;
const NEAR_MISS = 0.85;

export type Choice = { eaPlayerId: string; name: string; position: string; gp: number; lastPlayed: Date };

const timeOf = (games: GameLite[]) => {
  const byId = new Map(games.map((g) => [g.matchId, g]));
  return { byId, at: (l: PlayerLine) => byId.get(l.matchId)?.playedAt.getTime() ?? 0 };
};

/** Roster for "Who are you?": recent regulars first, everyone else behind "Show everyone". */
export function rosterChoices(lines: PlayerLine[], games: GameLite[], ourClubId: number, now: Date): { main: Choice[]; rest: Choice[] } {
  const { byId, at } = timeOf(games);
  const players = new Map<string, Choice & { everNonGuest: boolean; positions: Record<string, number> }>();
  for (const l of lines) {
    if (l.clubId !== ourClubId || !byId.has(l.matchId)) continue;
    const p = players.get(l.eaPlayerId) ?? { eaPlayerId: l.eaPlayerId, name: l.playerName, position: "", gp: 0, lastPlayed: new Date(0), everNonGuest: false, positions: {} };
    p.gp += 1;
    p.positions[l.position] = (p.positions[l.position] ?? 0) + 1;
    p.everNonGuest ||= !l.isGuest;
    if (at(l) >= p.lastPlayed.getTime()) {
      p.lastPlayed = new Date(at(l));
      p.name = l.playerName;
    }
    players.set(l.eaPlayerId, p);
  }
  const list = [...players.values()].map(({ everNonGuest, positions, ...c }) => ({
    choice: { ...c, position: Object.entries(positions).sort((a, b) => b[1] - a[1])[0][0] },
    everNonGuest,
  }));
  const recent = (c: Choice) => now.getTime() - c.lastPlayed.getTime() <= RECENT_DAYS * DAY;
  return {
    main: list
      .filter((x) => x.everNonGuest && recent(x.choice))
      .map((x) => x.choice)
      .sort((a, b) => b.lastPlayed.getTime() - a.lastPlayed.getTime()),
    rest: list
      .filter((x) => !(x.everNonGuest && recent(x.choice)))
      .map((x) => x.choice)
      .sort((a, b) => b.gp - a.gp),
  };
}

export type LastNight = {
  nightKey: string;
  label: string;
  playedAt: Date;
  gp: number;
  goals: number;
  assists: number;
  plusMinus: number;
  wins: number;
  losses: number;
  pointsVsAvg: number | null;
  goalie: { saves: number; shots: number; ga: number } | null;
};

/** Your totals on the latest game night you played. */
export function lastNight(lines: PlayerLine[], games: GameLite[], playerId: string, ourClubId: number): LastNight | null {
  const mine = lines.filter((l) => l.eaPlayerId === playerId && l.clubId === ourClubId);
  const mineById = new Map(mine.map((l) => [l.matchId, l]));
  const night = groupGameNights(games).find((n) => n.games.some((g) => mineById.has(g.matchId)));
  if (!night) return null;
  const played = night.games.filter((g) => mineById.has(g.matchId));
  const nightLines = played.map((g) => mineById.get(g.matchId)!);
  const skater = nightLines.filter((l) => l.position !== "goalie");
  const keeper = nightLines.filter((l) => l.position === "goalie");
  const pts = (ls: PlayerLine[]) => ls.reduce((s, l) => s + l.goals + l.assists, 0);
  const allSkater = mine.filter((l) => l.position !== "goalie");
  return {
    nightKey: night.key,
    label: night.label,
    playedAt: night.games[0].playedAt,
    gp: played.length,
    goals: nightLines.reduce((s, l) => s + l.goals, 0),
    assists: nightLines.reduce((s, l) => s + l.assists, 0),
    plusMinus: nightLines.reduce((s, l) => s + l.plusMinus, 0),
    wins: played.filter((g) => g.outcome === "W").length,
    losses: played.filter((g) => g.outcome === "L").length,
    pointsVsAvg: skater.length ? pts(skater) / skater.length - pts(allSkater) / allSkater.length : null,
    goalie: keeper.length
      ? { saves: keeper.reduce((s, l) => s + l.glSaves, 0), shots: keeper.reduce((s, l) => s + l.glShots, 0), ga: keeper.reduce((s, l) => s + l.glGa, 0) }
      : null,
  };
}

export type Streak = { key: "points" | "goals" | "games"; length: number };

/** Streaks still going (2+), counted over box-score games only. */
export function activeStreaks(lines: PlayerLine[], games: GameLite[], playerId: string): Streak[] {
  const full = [...games].filter((g) => g.source === "full").sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  const mine = new Map(lines.filter((l) => l.eaPlayerId === playerId).map((l) => [l.matchId, l]));
  const run = (ok: (l: PlayerLine | undefined) => boolean, list: GameLite[]) => {
    let n = 0;
    for (const g of list) {
      if (!ok(mine.get(g.matchId))) break;
      n++;
    }
    return n;
  };
  const myGames = full.filter((g) => mine.has(g.matchId));
  const out: Streak[] = [
    { key: "games", length: run((l) => !!l, full) },
    { key: "points", length: run((l) => !!l && l.goals + l.assists > 0, myGames) },
    { key: "goals", length: run((l) => !!l && l.goals > 0, myGames) },
  ];
  return out.filter((s) => s.length >= 2).sort((a, b) => b.length - a.length);
}

export type NextMilestone = { stat: MilestoneStat; target: number; remaining: number };

/** The closest round numbers ahead (relative to the target), including games without a box score. */
export function nextMilestones(lines: PlayerLine[], extras: ExtraStats[], playerId: string, max = 3): NextMilestone[] {
  const t: Record<MilestoneStat, number> = { games: 0, goals: 0, assists: 0, points: 0, hits: 0 };
  for (const l of lines) {
    if (l.eaPlayerId !== playerId) continue;
    t.games += 1;
    t.goals += l.goals;
    t.assists += l.assists;
    t.points += l.goals + l.assists;
    t.hits += l.hits;
  }
  for (const e of extras) {
    if (e.eaPlayerId !== playerId) continue;
    t.games += e.gp;
    t.goals += e.goals;
    t.assists += e.assists;
    t.points += e.goals + e.assists;
    t.hits += e.hits;
  }
  const out: NextMilestone[] = [];
  for (const stat of Object.keys(MILESTONE_STEPS) as MilestoneStat[]) {
    if (t[stat] === 0) continue;
    const target = MILESTONE_STEPS[stat].find((s) => s > t[stat]);
    if (target) out.push({ stat, target, remaining: target - t[stat] });
  }
  return out.sort((a, b) => a.remaining / a.target - b.remaining / b.target).slice(0, max);
}

/** Club records you hold, and single-game records you're within 15% of. */
export function recordStanding(
  records: RecordItem[],
  lines: PlayerLine[],
  playerId: string,
): { held: RecordItem[]; nearMisses: { record: RecordItem; best: number; short: number }[] } {
  const mine = lines.filter((l) => l.eaPlayerId === playerId);
  const nearMisses: { record: RecordItem; best: number; short: number }[] = [];
  for (const r of records) {
    const rule = PLAYER_RECORDS[r.key];
    if (!rule || r.holderId === playerId || !mine.length) continue;
    const best = Math.max(...mine.map(rule.value));
    if (best > 0 && best < r.value && best >= r.value * NEAR_MISS) nearMisses.push({ record: r, best, short: r.value - best });
  }
  return { held: records.filter((r) => r.holderId === playerId), nearMisses };
}

export type VsRow = { stat: string; mine: number; team: number; better: "higher" | "lower" };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Your per-game numbers next to the team's average (skater and/or goalie). */
export function vsTeam(lines: PlayerLine[], games: GameLite[], playerId: string, ourClubId: number): { skater: VsRow[] | null; goalie: VsRow[] | null } {
  const ids = new Set(games.map((g) => g.matchId));
  const ours = lines.filter((l) => l.clubId === ourClubId && ids.has(l.matchId));
  const sk = ours.filter((l) => l.position !== "goalie");
  const gl = ours.filter((l) => l.position === "goalie");
  const mySk = sk.filter((l) => l.eaPlayerId === playerId);
  const myGl = gl.filter((l) => l.eaPlayerId === playerId);
  const per = (ls: PlayerLine[], v: (l: PlayerLine) => number) => round2(ls.reduce((s, l) => s + v(l), 0) / ls.length);
  const savePct = (ls: PlayerLine[]) => {
    const shots = ls.reduce((s, l) => s + l.glShots, 0);
    return shots ? Math.round((ls.reduce((s, l) => s + l.glSaves, 0) / shots) * 1000) / 10 : 0;
  };
  const skaterRow = (stat: string, v: (l: PlayerLine) => number): VsRow => ({ stat, mine: per(mySk, v), team: per(sk, v), better: "higher" });
  return {
    skater: mySk.length
      ? [
          skaterRow("Goals", (l) => l.goals),
          skaterRow("Assists", (l) => l.assists),
          skaterRow("Points", (l) => l.goals + l.assists),
          skaterRow("Hits", (l) => l.hits),
          skaterRow("+/-", (l) => l.plusMinus),
        ]
      : null,
    goalie: myGl.length
      ? [
          { stat: "Save %", mine: savePct(myGl), team: savePct(gl), better: "higher" },
          { stat: "Goals against", mine: per(myGl, (l) => l.glGa), team: per(gl, (l) => l.glGa), better: "lower" },
        ]
      : null,
  };
}

/** The 2 teammates you win most with (3+ games together). */
export function bestTeammates(
  lines: PlayerLine[],
  games: GameLite[],
  playerId: string,
  ourClubId: number,
  minGames = 3,
): { eaPlayerId: string; name: string; gp: number; winPct: number }[] {
  const byId = new Map(games.map((g) => [g.matchId, g]));
  const ours = lines.filter((l) => l.clubId === ourClubId && byId.has(l.matchId));
  const myGames = new Set(ours.filter((l) => l.eaPlayerId === playerId).map((l) => l.matchId));
  const mates = new Map<string, { eaPlayerId: string; name: string; gp: number; wins: number }>();
  for (const l of ours) {
    if (l.eaPlayerId === playerId || !myGames.has(l.matchId)) continue;
    const m = mates.get(l.eaPlayerId) ?? { eaPlayerId: l.eaPlayerId, name: l.playerName, gp: 0, wins: 0 };
    m.gp += 1;
    if (byId.get(l.matchId)!.outcome === "W") m.wins += 1;
    m.name = l.playerName;
    mates.set(l.eaPlayerId, m);
  }
  return [...mates.values()]
    .filter((m) => m.gp >= minGames)
    .map(({ wins, ...m }) => ({ ...m, winPct: wins / m.gp }))
    .sort((a, b) => b.winPct - a.winPct || b.gp - a.gp)
    .slice(0, 2);
}

import type { GameNight } from "@/lib/stats/nights";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type StatLine = { goals: number; assists: number; points: number };
export type StatKey = keyof StatLine;
export type MateGroup = "all" | "forwards" | "defense";

const FORWARDS = new Set(["center", "leftWing", "rightWing"]);
const groupsOf = (position: string): MateGroup[] =>
  FORWARDS.has(position) ? ["all", "forwards"] : position === "defenseMen" ? ["all", "defense"] : position === "goalie" ? [] : ["all"];

export type NightPoint = {
  key: string;
  label: string;
  goalsFor: number;
  goalsAgainst: number;
  wins: number;
  losses: number;
  /** The fields below are only set when a player is picked. */
  /** False when every game that night saved only a final score, so nobody's stats are known. */
  boxScore?: boolean;
  /** The viewer's totals for the night; null when they didn't play (or no box score). */
  me?: StatLine | null;
  /**
   * Average per teammate of their night totals, one decimal, by the position they played in each game:
   * all skaters, forwards only, defense only. Null when no teammate played that role.
   */
  mates?: Record<MateGroup, StatLine | null>;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

function addLine(t: StatLine, l: PlayerLine) {
  t.goals += l.goals;
  t.assists += l.assists;
  t.points += l.goals + l.assists;
}

// Oldest → newest, limited to the most recent `max` nights.
// Pass `mine` (our club's lines) to add the picked player's stats and the teammate average per night.
export function nightSeries(nights: GameNight[], max = 12, mine?: { lines: PlayerLine[]; playerId: string }): NightPoint[] {
  const byMatch = new Map<string, PlayerLine[]>();
  for (const l of mine?.lines ?? []) byMatch.set(l.matchId, [...(byMatch.get(l.matchId) ?? []), l]);
  return nights
    .slice(0, max)
    .map((n) => {
      const point: NightPoint = { key: n.key, label: n.label, goalsFor: n.goalsFor, goalsAgainst: n.goalsAgainst, wins: n.wins, losses: n.losses };
      if (!mine) return point;
      // Score-only games have no player lines; leave them out of both sides.
      const full = n.games.filter((g) => g.source === "full");
      point.boxScore = full.length > 0;
      let me: StatLine | null = null;
      const perMate: Record<MateGroup, Map<string, StatLine>> = { all: new Map(), forwards: new Map(), defense: new Map() };
      for (const g of full) {
        for (const l of byMatch.get(g.matchId) ?? []) {
          if (l.eaPlayerId === mine.playerId) {
            addLine((me ??= { goals: 0, assists: 0, points: 0 }), l);
            continue;
          }
          for (const group of groupsOf(l.position)) {
            const t = perMate[group].get(l.eaPlayerId) ?? { goals: 0, assists: 0, points: 0 };
            addLine(t, l);
            perMate[group].set(l.eaPlayerId, t);
          }
        }
      }
      const average = (m: Map<string, StatLine>): StatLine | null => {
        const totals = [...m.values()];
        if (!totals.length) return null;
        const avg = (k: StatKey) => round1(totals.reduce((s, t) => s + t[k], 0) / totals.length);
        return { goals: avg("goals"), assists: avg("assists"), points: avg("points") };
      };
      point.me = me;
      point.mates = { all: average(perMate.all), forwards: average(perMate.forwards), defense: average(perMate.defense) };
      return point;
    })
    .reverse();
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", month: "short", day: "numeric" });

export type FormPoint = { matchId: string; label: string; goals: number; assists: number; points: number; outcome: "W" | "L" };

// A player's last `n` skater games, oldest → newest.
export function playerForm(lines: PlayerLine[], games: GameLite[], n = 10): FormPoint[] {
  // Box-score games only: a lone known line from a score-only game would skew the trend.
  const byId = new Map(games.filter((g) => g.source === "full").map((g) => [g.matchId, g]));
  return lines
    .filter((l) => l.position !== "goalie" && byId.has(l.matchId))
    .map((l) => ({ l, g: byId.get(l.matchId)! }))
    .sort((a, b) => a.g.playedAt.getTime() - b.g.playedAt.getTime())
    .slice(-n)
    .map(({ l, g }) => ({
      matchId: l.matchId,
      label: dayFmt.format(g.playedAt),
      goals: l.goals,
      assists: l.assists,
      points: l.goals + l.assists,
      outcome: g.outcome,
    }));
}

export type Heat = "hot" | "cold" | null;

const MIN_GAMES = 8;
const WINDOW = 5;

// Spec §5: last-5 points per game vs the player's overall club average (±25%), only after 8 games.
export function heat(lines: PlayerLine[], games: GameLite[], eaPlayerId: string): Heat {
  const form = playerForm(
    lines.filter((l) => l.eaPlayerId === eaPlayerId),
    games,
    Number.MAX_SAFE_INTEGER,
  );
  if (form.length < MIN_GAMES) return null;
  const overall = form.reduce((s, f) => s + f.points, 0) / form.length;
  const recent = form.slice(-WINDOW).reduce((s, f) => s + f.points, 0) / WINDOW;
  if (recent > 0 && recent >= overall * 1.25) return "hot";
  if (overall > 0 && recent <= overall * 0.75) return "cold";
  return null;
}

export function heatMap(lines: PlayerLine[], games: GameLite[], ourClubId: number): Map<string, Heat> {
  const ids = new Set(lines.filter((l) => l.clubId === ourClubId).map((l) => l.eaPlayerId));
  return new Map([...ids].map((id) => [id, heat(lines, games, id)]));
}

export function divisionJourney(snapshots: { takenAt: Date; division: number }[]): { division: number; from: Date; to: Date }[] {
  const runs: { division: number; from: Date; to: Date }[] = [];
  for (const s of [...snapshots].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())) {
    const last = runs.at(-1);
    if (last && last.division === s.division) last.to = s.takenAt;
    else runs.push({ division: s.division, from: s.takenAt, to: s.takenAt });
  }
  return runs;
}

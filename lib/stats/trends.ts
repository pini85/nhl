import type { GameNight } from "@/lib/stats/nights";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type StatLine = { goals: number; assists: number; points: number };
export type StatKey = keyof StatLine;
export type MateGroup = "all" | "forwards" | "defense";

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
  /** Each teammate skater's own totals for the night (every skater game, any position), by player id. */
  others?: Record<string, StatLine>;
  /** Where each teammate skater played most that night (ties go to forwards), by player id. */
  roles?: Record<string, "forwards" | "defense">;
};

export type Teammate = { id: string; name: string; role: "forwards" | "defense"; games: number };

function addLine(t: StatLine, l: PlayerLine) {
  t.goals += l.goals;
  t.assists += l.assists;
  t.points += l.goals + l.assists;
}

// Oldest → newest, limited to the most recent `max` nights.
// Pass `mine` (our club's lines) to add the picked player's stats and each teammate's stats per night.
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
      const others: Record<string, StatLine> = {};
      const fd: Record<string, { f: number; d: number }> = {};
      for (const g of full) {
        for (const l of byMatch.get(g.matchId) ?? []) {
          if (l.eaPlayerId === mine.playerId) {
            addLine((me ??= { goals: 0, assists: 0, points: 0 }), l);
            continue;
          }
          if (l.position !== "goalie") {
            addLine((others[l.eaPlayerId] ??= { goals: 0, assists: 0, points: 0 }), l);
            const c = (fd[l.eaPlayerId] ??= { f: 0, d: 0 });
            if (l.position === "defenseMen") c.d++;
            else c.f++;
          }
        }
      }
      point.me = me;
      point.others = others;
      point.roles = Object.fromEntries(Object.entries(fd).map(([id, c]) => [id, c.d > c.f ? "defense" : "forwards"]));
      return point;
    })
    .reverse();
}

// Teammate skaters who played box-score games in the newest `max` nights, most games first.
// Role is where they played most of those games (ties go to forwards).
export function nightTeammates(nights: GameNight[], lines: PlayerLine[], playerId: string, max = 12): Teammate[] {
  const ids = new Set(nights.slice(0, max).flatMap((n) => n.games.filter((g) => g.source === "full").map((g) => g.matchId)));
  const acc = new Map<string, { name: string; f: number; d: number }>();
  for (const l of lines) {
    if (!ids.has(l.matchId) || l.eaPlayerId === playerId || l.position === "goalie") continue;
    const t = acc.get(l.eaPlayerId) ?? { name: l.playerName, f: 0, d: 0 };
    if (l.position === "defenseMen") t.d++;
    else t.f++;
    t.name = l.playerName;
    acc.set(l.eaPlayerId, t);
  }
  return [...acc.entries()]
    .map(([id, t]) => ({ id, name: t.name, role: (t.d > t.f ? "defense" : "forwards") as Teammate["role"], games: t.f + t.d }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
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

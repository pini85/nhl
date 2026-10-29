import type { GameNight } from "@/lib/stats/nights";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type NightPoint = {
  key: string;
  label: string;
  goalsFor: number;
  goalsAgainst: number;
  wins: number;
  losses: number;
  /** The viewer's own goals that night; null when they didn't play. Absent when no player is picked. */
  myGoals?: number | null;
  /** Average goals per teammate skater that night (one decimal); null when no teammate data. Absent when no player is picked. */
  teammateAvg?: number | null;
};

// Oldest → newest, limited to the most recent `max` nights.
// Pass `mine` (our club's lines) to add the picked player's goals and the teammate average per night.
export function nightSeries(nights: GameNight[], max = 12, mine?: { lines: PlayerLine[]; playerId: string }): NightPoint[] {
  const myLines = mine ? new Map(mine.lines.filter((l) => l.eaPlayerId === mine.playerId).map((l) => [l.matchId, l])) : null;
  const byMatch = new Map<string, PlayerLine[]>();
  for (const l of mine?.lines ?? []) {
    if (l.eaPlayerId === mine?.playerId || l.position === "goalie") continue;
    byMatch.set(l.matchId, [...(byMatch.get(l.matchId) ?? []), l]);
  }
  return nights
    .slice(0, max)
    .map((n) => {
      const point: NightPoint = { key: n.key, label: n.label, goalsFor: n.goalsFor, goalsAgainst: n.goalsAgainst, wins: n.wins, losses: n.losses };
      if (myLines) {
        const played = n.games.map((g) => myLines.get(g.matchId)).filter((l) => l !== undefined);
        point.myGoals = played.length ? played.reduce((s, l) => s + l.goals, 0) : null;
        const perMate = new Map<string, number>();
        for (const g of n.games) for (const l of byMatch.get(g.matchId) ?? []) perMate.set(l.eaPlayerId, (perMate.get(l.eaPlayerId) ?? 0) + l.goals);
        const totals = [...perMate.values()];
        point.teammateAvg = totals.length ? Math.round((totals.reduce((s, x) => s + x, 0) / totals.length) * 10) / 10 : null;
      }
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

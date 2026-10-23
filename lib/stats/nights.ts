import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type GameNight = {
  key: string;
  label: string;
  games: GameLite[];
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

const HOUR = 3_600_000;

export function groupGameNights(games: GameLite[], tz = "Europe/Amsterdam", gapHours = 3): GameNight[] {
  const sorted = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const groups: GameLite[][] = [];
  for (const game of sorted) {
    const current = groups.at(-1);
    const last = current?.at(-1);
    if (current && last && game.playedAt.getTime() - last.playedAt.getTime() < gapHours * HOUR) current.push(game);
    else groups.push([game]);
  }

  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const labelFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });

  return groups
    .map((night) => {
      const first = night[0].playedAt;
      return {
        key: keyFmt.format(first),
        label: labelFmt.format(first).replace(",", ""),
        games: [...night].reverse(),
        wins: night.filter((g) => g.outcome === "W").length,
        losses: night.filter((g) => g.outcome === "L").length,
        goalsFor: night.reduce((s, g) => s + g.goalsFor, 0),
        goalsAgainst: night.reduce((s, g) => s + g.goalsAgainst, 0),
      };
    })
    .reverse();
}

const ratingSum = (p: Pick<PlayerLine, "ratingOffense" | "ratingDefense" | "ratingTeamplay">) =>
  p.ratingOffense + p.ratingDefense + p.ratingTeamplay;

type Rankable = { points: number; plusMinus: number; rating: number };
const byRank = (a: Rankable, b: Rankable) => b.points - a.points || b.plusMinus - a.plusMinus || b.rating - a.rating;

export function threeStars(lines: PlayerLine[], clubId?: number): PlayerLine[] {
  return lines
    .filter((l) => clubId === undefined || l.clubId === clubId)
    .map((l) => ({ l, points: l.goals + l.assists, plusMinus: l.plusMinus, rating: ratingSum(l) }))
    .sort(byRank)
    .slice(0, 3)
    .map((x) => x.l);
}

export function nightMvp(
  lines: PlayerLine[],
  ourClubId: number,
): { eaPlayerId: string; playerName: string; goals: number; assists: number; points: number } | null {
  const totals = new Map<string, { eaPlayerId: string; playerName: string; goals: number; assists: number; plusMinus: number; rating: number }>();
  for (const l of lines) {
    if (l.clubId !== ourClubId) continue;
    const t = totals.get(l.eaPlayerId) ?? { eaPlayerId: l.eaPlayerId, playerName: l.playerName, goals: 0, assists: 0, plusMinus: 0, rating: 0 };
    t.goals += l.goals;
    t.assists += l.assists;
    t.plusMinus += l.plusMinus;
    t.rating += ratingSum(l);
    t.playerName = l.playerName;
    totals.set(l.eaPlayerId, t);
  }
  const best = [...totals.values()].map((t) => ({ ...t, points: t.goals + t.assists })).sort(byRank)[0];
  if (!best) return null;
  return { eaPlayerId: best.eaPlayerId, playerName: best.playerName, goals: best.goals, assists: best.assists, points: best.points };
}

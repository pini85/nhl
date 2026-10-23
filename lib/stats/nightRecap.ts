import { groupGameNights, nightMvp, type GameNight } from "@/lib/stats/nights";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

type Leader = { name: string; value: number } | null;

export type NightRecap = {
  night: GameNight;
  mvp: ReturnType<typeof nightMvp>;
  stars: { name: string; eaPlayerId: string; goals: number; assists: number; points: number }[];
  leaders: { hits: Leader; plusMinus: Leader; shots: Leader; goalie: { name: string; saves: number; shots: number; pct: number } | null };
  hasPlayerData: boolean;
};

export function nightRecap(nightKey: string, games: GameLite[], lines: PlayerLine[], ourClubId: number): NightRecap | null {
  const night = groupGameNights(games).find((n) => n.key === nightKey);
  if (!night) return null;
  const ids = new Set(night.games.map((g) => g.matchId));
  const ours = lines.filter((l) => ids.has(l.matchId) && l.clubId === ourClubId);

  const totals = new Map<string, { name: string; eaPlayerId: string; goals: number; assists: number; plusMinus: number; hits: number; shots: number; saves: number; faced: number; rating: number }>();
  for (const l of ours) {
    const t = totals.get(l.eaPlayerId) ?? { name: l.playerName, eaPlayerId: l.eaPlayerId, goals: 0, assists: 0, plusMinus: 0, hits: 0, shots: 0, saves: 0, faced: 0, rating: 0 };
    t.goals += l.goals;
    t.assists += l.assists;
    t.plusMinus += l.plusMinus;
    t.hits += l.hits;
    t.shots += l.shots;
    t.saves += l.glSaves;
    t.faced += l.glShots;
    t.rating += l.ratingOffense + l.ratingDefense + l.ratingTeamplay;
    t.name = l.playerName;
    totals.set(l.eaPlayerId, t);
  }
  const list = [...totals.values()];
  const top = (v: (t: (typeof list)[number]) => number): Leader => {
    const best = [...list].sort((a, b) => v(b) - v(a))[0];
    return best && v(best) > 0 ? { name: best.name, value: v(best) } : null;
  };
  const goalie = [...list].filter((t) => t.faced > 0).sort((a, b) => b.faced - a.faced)[0];

  return {
    night,
    mvp: nightMvp(ours, ourClubId),
    stars: list
      .map((t) => ({ ...t, points: t.goals + t.assists }))
      .sort((a, b) => b.points - a.points || b.plusMinus - a.plusMinus || b.rating - a.rating)
      .slice(0, 3)
      .map(({ name, eaPlayerId, goals, assists, points }) => ({ name, eaPlayerId, goals, assists, points })),
    leaders: {
      hits: top((t) => t.hits),
      plusMinus: top((t) => t.plusMinus),
      shots: top((t) => t.shots),
      goalie: goalie ? { name: goalie.name, saves: goalie.saves, shots: goalie.faced, pct: goalie.saves / goalie.faced } : null,
    },
    hasPlayerData: ours.length > 0,
  };
}

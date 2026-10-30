import type { GameLite } from "@/lib/stats/types";

export type WLO = { wins: number; losses: number; otLosses: number };

/** Wins, regulation losses and overtime losses, NHL style. */
export function countRecord(games: Pick<GameLite, "outcome" | "overtime">[]): WLO {
  return {
    wins: games.filter((g) => g.outcome === "W").length,
    losses: games.filter((g) => g.outcome === "L" && !g.overtime).length,
    otLosses: games.filter((g) => g.outcome === "L" && g.overtime).length,
  };
}

/** "3-2", or "1-1-2" when there were overtime losses. */
export function formatRecord(r: WLO, sep = "-"): string {
  return r.otLosses ? `${r.wins}${sep}${r.losses}${sep}${r.otLosses}` : `${r.wins}${sep}${r.losses}`;
}

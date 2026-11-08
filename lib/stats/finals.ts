import { toInt } from "@/lib/ea/normalize";
import { countRecord, type WLO } from "@/lib/stats/record";
import type { GameLite } from "@/lib/stats/types";

export type ClubFinals = {
  /** Seasons that ended in a Club Finals run, all-time (EA's own counter). */
  appearances: number;
  /** Club Finals cups won, all-time. */
  cups: number;
  /** Playoff game record from the games we have saved. */
  record: WLO;
  games: number;
};

/** Club Finals totals: EA's all-time counters plus the W-L of saved playoff games. */
export function clubFinals(raw: unknown, games: Pick<GameLite, "matchType" | "outcome" | "overtime">[]): ClubFinals {
  const r = (raw ?? {}) as Record<string, unknown>;
  const playoffGames = games.filter((g) => g.matchType === "gameType10");
  const cupsByLevel = [1, 2, 3, 4, 5].reduce((n, i) => n + toInt(r[`cupsWon${i}`]), 0);
  return {
    appearances: Math.max(toInt(r.clubfinalsplayed), toInt(r.cupsEntered)),
    cups: Math.max(toInt(r.totalCupsWon), cupsByLevel),
    record: countRecord(playoffGames),
    games: playoffGames.length,
  };
}

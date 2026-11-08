import { toInt } from "@/lib/ea/normalize";
import { groupGameNights, type GameNight } from "@/lib/stats/nights";
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
  /** Deepest round reached in one finals night (each finals game is a round). */
  furthestRound: number;
  /** Finals nights, newest first; each game in a run is one round. */
  runs: GameNight[];
};

/** Club Finals totals: EA's all-time counters plus the W-L and rounds of saved playoff games. */
export function clubFinals(raw: unknown, games: GameLite[]): ClubFinals {
  const r = (raw ?? {}) as Record<string, unknown>;
  const playoffGames = games.filter((g) => g.matchType === "gameType10");
  const cupsByLevel = [1, 2, 3, 4, 5].reduce((n, i) => n + toInt(r[`cupsWon${i}`]), 0);
  const runs = playoffGames.length ? groupGameNights(playoffGames) : [];
  return {
    appearances: Math.max(toInt(r.clubfinalsplayed), toInt(r.cupsEntered)),
    cups: Math.max(toInt(r.totalCupsWon), cupsByLevel),
    record: countRecord(playoffGames),
    games: playoffGames.length,
    furthestRound: Math.max(0, ...runs.map((n) => n.games.length)),
    runs,
  };
}

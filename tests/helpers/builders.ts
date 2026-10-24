import type { GameLite, PlayerLine } from "@/lib/stats/types";

// Small hand-built games and player lines for stats tests.
export const CLUB = 56507;
export const SINCE = new Date("2026-10-10T00:00:00Z");

export const game = (matchId: string, iso: string, extra: Partial<GameLite> = {}): GameLite => ({
  matchId,
  playedAt: new Date(iso),
  opponentClubId: 1,
  opponentName: "Opp",
  goalsFor: 1,
  goalsAgainst: 2,
  outcome: "L",
  overtime: false,
  dnf: "",
  source: "full",
  matchType: "gameType5",
  ...extra,
});

export const ZERO: Omit<PlayerLine, "matchId" | "eaPlayerId" | "playerName"> = {
  clubId: CLUB,
  position: "center",
  isGuest: false,
  goals: 0,
  assists: 0,
  plusMinus: 0,
  shots: 0,
  hits: 0,
  pim: 0,
  takeaways: 0,
  blockedShots: 0,
  interceptions: 0,
  passAttempts: 0,
  passes: 0,
  giveaways: 0,
  ppg: 0,
  shg: 0,
  gwg: 0,
  toiSeconds: 1200,
  glSaves: 0,
  glShots: 0,
  glGa: 0,
  ratingOffense: 0,
  ratingDefense: 0,
  ratingTeamplay: 0,
};
export const line = (matchId: string, eaPlayerId: string, playerName: string, stats: Partial<PlayerLine> = {}): PlayerLine => ({
  ...ZERO,
  matchId,
  eaPlayerId,
  playerName,
  ...stats,
});


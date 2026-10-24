export type GameLite = {
  matchId: string;
  playedAt: Date;
  opponentClubId: number;
  opponentName: string | null;
  goalsFor: number;
  goalsAgainst: number;
  outcome: "W" | "L";
  overtime: boolean;
  dnf: string;
  source: "full" | "summary";
  matchType: string;
};

export type PlayerLine = {
  matchId: string;
  clubId: number;
  eaPlayerId: string;
  playerName: string;
  position: string;
  isGuest: boolean;
  goals: number;
  assists: number;
  plusMinus: number;
  shots: number;
  hits: number;
  pim: number;
  takeaways: number;
  passAttempts: number;
  passes: number;
  giveaways: number;
  ppg: number;
  shg: number;
  gwg: number;
  toiSeconds: number;
  glSaves: number;
  glShots: number;
  glGa: number;
  ratingOffense: number;
  ratingDefense: number;
  ratingTeamplay: number;
};

// Stats from games without a box score (from the in-game club totals), added on top of box-score totals.
export type ExtraStats = {
  eaPlayerId: string;
  playerName: string;
  coversFrom: Date;
  gp: number;
  goals: number;
  assists: number;
  plusMinus: number;
  shots: number;
  hits: number;
  pim: number;
  ppg: number;
  shg: number;
  takeaways: number;
  giveaways: number;
};

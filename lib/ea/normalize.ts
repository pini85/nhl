import type { EaMatch, EaSeasonalStats } from "@/lib/ea/schemas";

export type Outcome = "W" | "L";
export type Dnf = "none" | "opponent_quit" | "we_quit";

export function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function toInt(v: unknown): number {
  return Math.trunc(toNum(v));
}

// Codes seen in real games (2026-10-23). Anything else falls back to the score.
const RESULT_CODES: Record<string, { outcome: Outcome; overtime: boolean; dnf: Dnf }> = {
  "1": { outcome: "W", overtime: false, dnf: "none" },
  "2": { outcome: "L", overtime: false, dnf: "none" },
  "5": { outcome: "W", overtime: true, dnf: "none" },
  "6": { outcome: "L", overtime: true, dnf: "none" },
  "16385": { outcome: "W", overtime: false, dnf: "opponent_quit" },
  "10": { outcome: "L", overtime: false, dnf: "we_quit" },
};

export function decodeResult(
  code: string,
  goalsFor: number,
  goalsAgainst: number,
): { outcome: Outcome; overtime: boolean; dnf: Dnf } {
  const known = RESULT_CODES[code];
  if (known) return { ...known };
  return { outcome: goalsFor > goalsAgainst ? "W" : "L", overtime: false, dnf: "none" };
}

export type MatchRow = {
  matchId: string;
  playedAt: Date;
  matchType: string;
  source: "full" | "summary";
  opponentClubId: number;
  goalsFor: number;
  goalsAgainst: number;
  outcome: Outcome;
  overtime: boolean;
  dnf: Dnf;
  resultCode: string | null;
  timestampEstimated: boolean;
  raw: unknown;
};

export type MatchClubRow = {
  matchId: string;
  clubId: number;
  name: string;
  crestAssetId: string | null;
  division: number;
  score: number;
  shots: number;
  hits: number;
  pim: number;
  passAttempts: number;
  passCompletions: number;
  ppg: number;
  ppo: number;
  faceoffWins: number;
  faceoffLosses: number;
  toaSeconds: number;
  memberString: string | null;
};

export type MatchPlayerRow = {
  matchId: string;
  clubId: number;
  eaPlayerId: string;
  playerName: string;
  position: string;
  isGuest: boolean;
  dnf: boolean;
  platform: string | null;
  playerLevel: number;
  toiSeconds: number;
  goals: number;
  assists: number;
  plusMinus: number;
  shots: number;
  shotAttempts: number;
  hits: number;
  pim: number;
  ppg: number;
  shg: number;
  gwg: number;
  blockedShots: number;
  takeaways: number;
  giveaways: number;
  interceptions: number;
  passAttempts: number;
  passes: number;
  faceoffWins: number;
  faceoffLosses: number;
  possessionSeconds: number;
  penaltiesDrawn: number;
  deflections: number;
  saucerPasses: number;
  glSaves: number;
  glShots: number;
  glGa: number;
  glSavePct: number;
  glPokeChecks: number;
  ratingOffense: number;
  ratingDefense: number;
  ratingTeamplay: number;
};

export type NormalizedMatch = { match: MatchRow; clubs: MatchClubRow[]; players: MatchPlayerRow[] };

type Bag = Record<string, unknown>;

function clubRow(matchId: string, clubId: number, c: Bag, agg: Bag): MatchClubRow {
  const details = (c.details ?? {}) as Bag;
  const kit = (details.customKit ?? {}) as Bag;
  return {
    matchId,
    clubId,
    name: String(details.name ?? ""),
    crestAssetId: kit.crestAssetId != null ? String(kit.crestAssetId) : null,
    division: toInt(c.clubDivision),
    score: toInt(c.score),
    shots: toInt(c.shots),
    hits: toInt(agg.skhits),
    pim: toInt(agg.skpim),
    passAttempts: toInt(c.passa),
    passCompletions: toInt(c.passc),
    ppg: toInt(c.ppg),
    ppo: toInt(c.ppo),
    faceoffWins: toInt(agg.skfow),
    faceoffLosses: toInt(agg.skfol),
    toaSeconds: toInt(c.toa),
    memberString: c.memberString != null ? String(c.memberString) : null,
  };
}

function playerRow(matchId: string, clubId: number, eaPlayerId: string, p: Bag): MatchPlayerRow {
  return {
    matchId,
    clubId,
    eaPlayerId,
    playerName: String(p.playername ?? ""),
    position: String(p.position ?? ""),
    isGuest: String(p.isGuest) === "1",
    dnf: String(p.player_dnf) === "1",
    platform: p.clientPlatform != null ? String(p.clientPlatform) : null,
    playerLevel: toInt(p.playerLevel),
    toiSeconds: toInt(p.toiseconds),
    goals: toInt(p.skgoals),
    assists: toInt(p.skassists),
    plusMinus: toInt(p.skplusmin),
    shots: toInt(p.skshots),
    shotAttempts: toInt(p.skshotattempts),
    hits: toInt(p.skhits),
    pim: toInt(p.skpim),
    ppg: toInt(p.skppg),
    shg: toInt(p.skshg),
    gwg: toInt(p.skgwg),
    blockedShots: toInt(p.skbs),
    takeaways: toInt(p.sktakeaways),
    giveaways: toInt(p.skgiveaways),
    interceptions: toInt(p.skinterceptions),
    passAttempts: toInt(p.skpassattempts),
    passes: toInt(p.skpasses),
    faceoffWins: toInt(p.skfow),
    faceoffLosses: toInt(p.skfol),
    possessionSeconds: toInt(p.skpossession),
    penaltiesDrawn: toInt(p.skpenaltiesdrawn),
    deflections: toInt(p.skdeflections),
    saucerPasses: toInt(p.sksaucerpasses),
    glSaves: toInt(p.glsaves),
    glShots: toInt(p.glshots),
    glGa: toInt(p.glga),
    glSavePct: toNum(p.glsavepct),
    glPokeChecks: toInt(p.glpokechecks),
    ratingOffense: toNum(p.ratingOffense),
    ratingDefense: toNum(p.ratingDefense),
    ratingTeamplay: toNum(p.ratingTeamplay),
  };
}

export function normalizeMatch(raw: EaMatch, matchType: string, ourClubId: number): NormalizedMatch {
  const ourKey = String(ourClubId);
  const ours = raw.clubs[ourKey] as Bag | undefined;
  if (!ours) throw new Error(`Club ${ourClubId} is not in match ${raw.matchId}`);

  const opponentClubId = toInt(ours.opponentClubId);
  const goalsFor = toInt(ours.score);
  const goalsAgainst = toInt(ours.opponentScore ?? raw.clubs[String(opponentClubId)]?.score);
  const resultCode = String(ours.result);

  const match: MatchRow = {
    matchId: raw.matchId,
    playedAt: new Date(raw.timestamp * 1000),
    matchType,
    source: "full",
    opponentClubId,
    goalsFor,
    goalsAgainst,
    ...decodeResult(resultCode, goalsFor, goalsAgainst),
    resultCode,
    timestampEstimated: false,
    raw,
  };

  const clubs = Object.entries(raw.clubs).map(([id, c]) =>
    clubRow(raw.matchId, toInt(id), c as Bag, (raw.aggregate[id] ?? {}) as Bag),
  );

  const players = Object.entries(raw.players).flatMap(([clubId, byId]) =>
    Object.entries(byId).map(([pid, p]) => playerRow(raw.matchId, toInt(clubId), pid, p as Bag)),
  );

  return { match, clubs, players };
}

export type RecentResult = {
  index: number;
  opponentClubId: number;
  goalsFor: number;
  goalsAgainst: number;
  outcome: Outcome;
};

// recentScoreN is "<opponent goals>-<our goals>"; index 0 is the newest game.
export function parseRecentResults(s: EaSeasonalStats): RecentResult[] {
  const out: RecentResult[] = [];
  for (let i = 0; i < 10; i++) {
    const opp = String(s[`recentOpponent${i}`] ?? "");
    const score = String(s[`recentScore${i}`] ?? "");
    const m = /^(\d+)-(\d+)$/.exec(score);
    if (!opp || opp === "0" || !m) continue;
    const goalsAgainst = Number(m[1]);
    const goalsFor = Number(m[2]);
    out.push({
      index: i,
      opponentClubId: Number(opp),
      goalsFor,
      goalsAgainst,
      outcome: goalsFor > goalsAgainst ? "W" : "L",
    });
  }
  return out;
}

export type RosterMember = {
  name: string;
  position: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  raw: Record<string, unknown>;
};

export function toRosterMember(m: Record<string, unknown>): RosterMember {
  return {
    name: String(m.name ?? ""),
    position: String(m.favoritePosition ?? ""),
    gp: toInt(m.skgp),
    goals: toInt(m.skgoals),
    assists: toInt(m.skassists),
    points: toInt(m.skpoints),
    plusMinus: toInt(m.skplusmin),
    raw: m,
  };
}

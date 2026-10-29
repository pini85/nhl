import { type MatchClubRow, type RosterMember, toInt, toNum } from "@/lib/ea/normalize";
import type { OpponentProfile } from "@/lib/opponents/profile";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type H2H = {
  clubId: number;
  name: string | null;
  gp: number;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  winPct: number;
  goalDiff: number;
  lastPlayedAt: Date;
  games: GameLite[];
};

export function headToHead(games: GameLite[]): H2H[] {
  const byClub = new Map<number, GameLite[]>();
  for (const g of games) byClub.set(g.opponentClubId, [...(byClub.get(g.opponentClubId) ?? []), g]);

  return [...byClub.entries()]
    .map(([clubId, list]) => {
      const sorted = [...list].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
      const wins = sorted.filter((g) => g.outcome === "W").length;
      const goalsFor = sorted.reduce((s, g) => s + g.goalsFor, 0);
      const goalsAgainst = sorted.reduce((s, g) => s + g.goalsAgainst, 0);
      return {
        clubId,
        name: sorted.find((g) => g.opponentName)?.opponentName ?? null,
        gp: sorted.length,
        wins,
        losses: sorted.length - wins,
        goalsFor,
        goalsAgainst,
        winPct: wins / sorted.length,
        goalDiff: goalsFor - goalsAgainst,
        lastPlayedAt: sorted[0].playedAt,
        games: sorted,
      };
    })
    .sort((a, b) => b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime());
}

// Clubs played this often rank above single games: a bigger sample says more.
const SOLID_SAMPLE = 2;
const sampleGroup = (h: H2H) => (h.gp >= SOLID_SAMPLE ? 0 : 1);
const newestFirst = (a: H2H, b: H2H) => b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime();

// Clubs we have a losing record against: worst record, then worst goal difference, then fewest goals scored.
export function nemesis(h2h: H2H[], n = 3): H2H[] {
  return h2h
    .filter((h) => h.losses > h.wins)
    .sort(
      (a, b) =>
        sampleGroup(a) - sampleGroup(b) ||
        a.winPct - b.winPct ||
        a.goalDiff - b.goalDiff ||
        a.goalsFor - b.goalsFor ||
        newestFirst(a, b),
    )
    .slice(0, n);
}

// Clubs we have a winning record against: best record, then best goal difference, then most goals scored.
export function punchingBags(h2h: H2H[], n = 3): H2H[] {
  return h2h
    .filter((h) => h.wins > h.losses)
    .sort(
      (a, b) =>
        sampleGroup(a) - sampleGroup(b) ||
        b.winPct - a.winPct ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        newestFirst(a, b),
    )
    .slice(0, n);
}

export function dangerousPlayers(
  lines: PlayerLine[],
  opponentClubId: number,
): { name: string; gp: number; goals: number; assists: number; points: number }[] {
  const totals = new Map<string, { name: string; gp: number; goals: number; assists: number }>();
  for (const l of lines) {
    if (l.clubId !== opponentClubId) continue;
    const t = totals.get(l.eaPlayerId) ?? { name: l.playerName, gp: 0, goals: 0, assists: 0 };
    t.gp++;
    t.goals += l.goals;
    t.assists += l.assists;
    t.name = l.playerName;
    totals.set(l.eaPlayerId, t);
  }
  return [...totals.values()]
    .map((t) => ({ ...t, points: t.goals + t.assists }))
    .filter((t) => t.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5);
}

export type StyleAverages = { shots: number; hits: number; pim: number; faceoffPct: number; passPct: number };

export function ourAverages(clubs: MatchClubRow[], ourClubId: number): StyleAverages {
  const ours = clubs.filter((c) => c.clubId === ourClubId);
  if (!ours.length) return { shots: 0, hits: 0, pim: 0, faceoffPct: 0, passPct: 0 };
  const sum = (f: (c: MatchClubRow) => number) => ours.reduce((s, c) => s + f(c), 0);
  const fow = sum((c) => c.faceoffWins);
  const fol = sum((c) => c.faceoffLosses);
  const passa = sum((c) => c.passAttempts);
  return {
    shots: sum((c) => c.shots) / ours.length,
    hits: sum((c) => c.hits) / ours.length,
    pim: sum((c) => c.pim) / ours.length,
    faceoffPct: fow + fol ? fow / (fow + fol) : 0,
    passPct: passa ? sum((c) => c.passCompletions) / passa : 0,
  };
}

export function playStyle(profile: OpponentProfile, ours: StyleAverages): string[] {
  const t = profile.avg;
  const above = (theirs: number, mine: number, factor: number) => mine > 0 && theirs >= mine * factor;
  const below = (theirs: number, mine: number, factor: number) => mine > 0 && theirs <= mine * factor;
  const labels: string[] = [];
  if (above(t.hits, ours.hits, 1.2)) labels.push("Very physical");
  if (above(t.shots, ours.shots, 1.2)) labels.push("Shoots a lot");
  if (above(t.pim, ours.pim, 1.2)) labels.push("Takes penalties");
  if (below(t.pim, ours.pim, 0.8)) labels.push("Disciplined");
  if (above(t.faceoffPct, ours.faceoffPct, 1.1)) labels.push("Strong on faceoffs");
  if (above(t.passPct, ours.passPct, 1.1)) labels.push("Passes well");
  return labels;
}

export type ClubTotals = {
  gp: number;
  wins: number;
  losses: number;
  otl: number;
  winPct: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  goalDiff: number;
  seasons: number;
  titles: number;
  promotions: number;
  relegations: number;
  rankingPoints: number;
};

// A club's all-time numbers from the EA club info we save with every snapshot.
export function clubTotals(snapshot: { wins: number; losses: number; otl: number; raw: unknown }): ClubTotals | null {
  const info = ((snapshot.raw as { info?: Record<string, unknown> } | null)?.info ?? {}) as Record<string, unknown>;
  const { wins, losses, otl } = snapshot;
  const gp = wins + losses + otl || toInt(info.totalGames);
  if (!gp) return null;
  const goalsFor = toInt(info.goals);
  const goalsAgainst = toInt(info.goalsAgainst);
  return {
    gp,
    wins,
    losses,
    otl,
    winPct: wins / gp,
    goalsFor,
    goalsAgainst,
    goalsForPerGame: goalsFor / gp,
    goalsAgainstPerGame: goalsAgainst / gp,
    goalDiff: goalsFor - goalsAgainst,
    seasons: toInt(info.seasons),
    titles: toInt(info.titlesWon),
    promotions: toInt(info.promotions),
    relegations: toInt(info.relegations),
    rankingPoints: toInt(info.rankingPoints),
  };
}

export type SkaterRow = { name: string; position: string; gp: number; goals: number; assists: number; points: number; plusMinus: number; pointsPerGame: number };
export type GoalieRow = { name: string; gp: number; wins: number; savePct: number; gaa: number; shutouts: number };

// Career numbers for the roster: skaters by points, goalies by games in net.
export function rosterStats(members: RosterMember[] | null): { skaters: SkaterRow[]; goalies: GoalieRow[] } {
  const list = members ?? [];
  const skaters = list
    .filter((m) => m.gp > 0)
    .map((m) => ({
      name: m.name,
      position: m.position,
      gp: m.gp,
      goals: m.goals,
      assists: m.assists,
      points: m.points,
      plusMinus: m.plusMinus,
      pointsPerGame: m.points / m.gp,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals);
  const goalies = list
    .map((m) => ({
      name: m.name,
      gp: toInt(m.raw.glgp),
      wins: toInt(m.raw.glwins),
      savePct: toNum(m.raw.glsavepct),
      gaa: toNum(m.raw.glgaa),
      shutouts: toInt(m.raw.glso),
    }))
    .filter((g) => g.gp > 0)
    .sort((a, b) => b.gp - a.gp);
  return { skaters, goalies };
}

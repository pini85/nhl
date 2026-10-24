import type { MatchClubRow, RosterMember } from "@/lib/ea/normalize";
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

const MIN_GAMES = 2;

// Clubs we have a losing record against, worst first.
export function nemesis(h2h: H2H[], n = 3): H2H[] {
  return h2h
    .filter((h) => h.gp >= MIN_GAMES && h.losses > h.wins)
    .sort((a, b) => a.winPct - b.winPct || a.goalDiff - b.goalDiff || b.gp - a.gp)
    .slice(0, n);
}

// Clubs we have a winning record against, best first.
export function punchingBags(h2h: H2H[], n = 3): H2H[] {
  return h2h
    .filter((h) => h.gp >= MIN_GAMES && h.wins > h.losses)
    .sort((a, b) => b.winPct - a.winPct || b.goalDiff - a.goalDiff || b.gp - a.gp)
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

// Share of games the roster's players didn't finish (EA counts DNFs per player).
export function quitRate(members: RosterMember[] | null): number | null {
  if (!members?.length) return null;
  let played = 0;
  let unfinished = 0;
  for (const m of members) {
    const gp = Number(m.raw.gamesplayed ?? 0);
    const done = Number(m.raw.gamesCompleted ?? gp);
    if (!Number.isFinite(gp) || gp <= 0) continue;
    played += gp;
    unfinished += Math.max(0, gp - (Number.isFinite(done) ? done : gp));
  }
  return played ? unfinished / played : null;
}

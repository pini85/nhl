import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type RecordItem = {
  key: string;
  label: string;
  value: number;
  holder: string | null;
  matchId: string | null;
  playedAt: Date;
};

const chrono = (games: GameLite[]) => [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

// Highest value wins; on a tie the earliest game keeps the record.
function best<T>(items: T[], value: (t: T) => number, at: (t: T) => number): T | null {
  let top: T | null = null;
  for (const it of items) {
    if (!top || value(it) > value(top) || (value(it) === value(top) && at(it) < at(top))) top = it;
  }
  return top;
}

export function clubRecords(lines: PlayerLine[], games: GameLite[], ourClubId: number): RecordItem[] {
  if (!games.length) return [];
  const byId = new Map(games.map((g) => [g.matchId, g]));
  const ours = lines.filter((l) => l.clubId === ourClubId && byId.has(l.matchId));
  const at = (l: PlayerLine) => byId.get(l.matchId)!.playedAt.getTime();
  const records: RecordItem[] = [];

  const playerRecord = (key: string, label: string, v: (l: PlayerLine) => number) => {
    const top = best(ours, v, at);
    if (top && v(top) > 0) {
      records.push({ key, label, value: v(top), holder: top.playerName, matchId: top.matchId, playedAt: byId.get(top.matchId)!.playedAt });
    }
  };
  playerRecord("goals-game", "Most goals in a game", (l) => l.goals);
  playerRecord("assists-game", "Most assists in a game", (l) => l.assists);
  playerRecord("points-game", "Most points in a game", (l) => l.goals + l.assists);
  playerRecord("hits-game", "Most hits in a game", (l) => l.hits);
  playerRecord("shots-game", "Most shots in a game", (l) => l.shots);

  const t = (g: GameLite) => g.playedAt.getTime();
  const mostGoals = best(games, (g) => g.goalsFor, t)!;
  records.push({ key: "team-goals-game", label: "Most team goals in a game", value: mostGoals.goalsFor, holder: null, matchId: mostGoals.matchId, playedAt: mostGoals.playedAt });

  const wins = games.filter((g) => g.outcome === "W");
  const bigWin = best(wins, (g) => g.goalsFor - g.goalsAgainst, t);
  if (bigWin) {
    records.push({ key: "biggest-win", label: "Biggest win", value: bigWin.goalsFor - bigWin.goalsAgainst, holder: null, matchId: bigWin.matchId, playedAt: bigWin.playedAt });
  }

  let run = 0;
  let bestRun = 0;
  let bestEnd: GameLite | null = null;
  for (const g of chrono(games)) {
    run = g.outcome === "W" ? run + 1 : 0;
    if (run > bestRun) {
      bestRun = run;
      bestEnd = g;
    }
  }
  if (bestEnd) records.push({ key: "win-streak", label: "Longest win streak", value: bestRun, holder: null, matchId: bestEnd.matchId, playedAt: bestEnd.playedAt });

  const ps = pointStreaks(ours, byId);
  if (ps && ps.value > 1) records.push({ key: "point-streak", label: "Longest point streak", ...ps });

  return records;
}

function pointStreaks(lines: PlayerLine[], byId: Map<string, GameLite>) {
  const perPlayer = new Map<string, PlayerLine[]>();
  for (const l of lines) if (l.position !== "goalie") perPlayer.set(l.eaPlayerId, [...(perPlayer.get(l.eaPlayerId) ?? []), l]);
  let top: { value: number; holder: string; matchId: string; playedAt: Date } | null = null;
  for (const list of perPlayer.values()) {
    const sorted = list.sort((a, b) => byId.get(a.matchId)!.playedAt.getTime() - byId.get(b.matchId)!.playedAt.getTime());
    let run = 0;
    for (const l of sorted) {
      run = l.goals + l.assists > 0 ? run + 1 : 0;
      const playedAt = byId.get(l.matchId)!.playedAt;
      if (run > 0 && (!top || run > top.value || (run === top.value && playedAt < top.playedAt))) {
        top = { value: run, holder: sorted.at(-1)!.playerName, matchId: l.matchId, playedAt };
      }
    }
  }
  return top;
}

export function currentStreak(games: GameLite[]): { kind: "W" | "L"; length: number } | null {
  const newest = chrono(games).reverse();
  if (!newest.length) return null;
  const kind = newest[0].outcome;
  let length = 0;
  for (const g of newest) {
    if (g.outcome !== kind) break;
    length++;
  }
  return { kind, length };
}

const POINT_STEPS = [10, 25, 50, 100, 200, 500];
const GOAL_STEPS = [10, 25, 50, 100, 250];

export function milestones(
  lines: PlayerLine[],
  games: GameLite[],
  ourClubId: number,
): { label: string; reachedAt: Date; matchId: string; holder: string | null }[] {
  const out: { label: string; reachedAt: Date; matchId: string; holder: string | null }[] = [];
  let goals = 0;
  let points = 0;
  let hatTrickSeen = false;
  for (const g of chrono(games.filter((x) => x.source === "full"))) {
    const ours = lines.filter((l) => l.matchId === g.matchId && l.clubId === ourClubId);
    const before = { goals, points };
    goals += ours.reduce((s, l) => s + l.goals, 0);
    points += ours.reduce((s, l) => s + l.goals + l.assists, 0);
    for (const step of GOAL_STEPS) if (before.goals < step && goals >= step) out.push({ label: `Club goals: ${step}`, reachedAt: g.playedAt, matchId: g.matchId, holder: null });
    for (const step of POINT_STEPS) if (before.points < step && points >= step) out.push({ label: `Club points: ${step}`, reachedAt: g.playedAt, matchId: g.matchId, holder: null });
    const hat = ours.find((l) => l.goals >= 3);
    if (hat && !hatTrickSeen) {
      hatTrickSeen = true;
      out.push({ label: "First hat trick", reachedAt: g.playedAt, matchId: g.matchId, holder: hat.playerName });
    }
  }
  return out;
}

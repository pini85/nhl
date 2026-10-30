import type { RosterMember } from "@/lib/ea/normalize";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

export type Badge = "member" | "former" | "guest";

export type SkaterTotals = {
  eaPlayerId: string;
  name: string;
  badge: Badge;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  shots: number;
  hits: number;
  pim: number;
  takeaways: number;
  giveaways: number;
  ppg: number;
  shg: number;
  gwg: number;
  blockedShots: number;
  interceptions: number;
  passAttempts: number;
  passes: number;
  passPct: number;
  shotPct: number;
  pointsPerGame: number;
  positions: Record<string, number>;
};

export type GoalieTotals = {
  eaPlayerId: string;
  name: string;
  badge: Badge;
  gp: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number;
  gaa: number;
  wins: number;
  losses: number;
  otLosses: number;
};

export function playerBadge(
  _eaPlayerId: string,
  name: string,
  roster: RosterMember[] | null,
  everNonGuest: boolean,
): Badge {
  const onRoster = roster?.some((m) => m.name.toLowerCase() === name.toLowerCase()) ?? false;
  if (onRoster) return "member";
  return everNonGuest ? "former" : "guest";
}

const isGoalie = (l: PlayerLine) => l.position === "goalie";

export function playerTotals(
  lines: PlayerLine[],
  games: GameLite[],
  roster: RosterMember[] | null,
  ourClubId: number,
  extras: ExtraStats[] = [],
): { skaters: SkaterTotals[]; goalies: GoalieTotals[] } {
  const gameById = new Map(games.map((g) => [g.matchId, g]));
  const ours = lines.filter((l) => l.clubId === ourClubId);

  // Latest name and "ever a non-guest" per player.
  const meta = new Map<string, { name: string; everNonGuest: boolean }>();
  for (const l of ours) {
    const m = meta.get(l.eaPlayerId) ?? { name: l.playerName, everNonGuest: false };
    m.name = l.playerName;
    m.everNonGuest ||= !l.isGuest;
    meta.set(l.eaPlayerId, m);
  }
  // Extra stats come from the club's own totals, so their players are club members.
  for (const e of extras) if (!meta.has(e.eaPlayerId)) meta.set(e.eaPlayerId, { name: e.playerName, everNonGuest: true });
  const badgeOf = (id: string) => {
    const m = meta.get(id)!;
    return playerBadge(id, m.name, roster, m.everNonGuest);
  };

  const skaters = new Map<string, SkaterTotals>();
  const goalies = new Map<string, GoalieTotals>();
  const emptySkater = (eaPlayerId: string): SkaterTotals => ({
    eaPlayerId, name: "", badge: "guest", gp: 0, goals: 0, assists: 0, points: 0,
    plusMinus: 0, shots: 0, hits: 0, pim: 0, takeaways: 0, giveaways: 0, ppg: 0, shg: 0, gwg: 0,
    blockedShots: 0, interceptions: 0, passAttempts: 0, passes: 0, passPct: 0,
    shotPct: 0, pointsPerGame: 0, positions: {},
  });

  for (const l of ours) {
    if (isGoalie(l)) {
      const g = goalies.get(l.eaPlayerId) ?? {
        eaPlayerId: l.eaPlayerId, name: "", badge: "guest" as Badge, gp: 0, saves: 0, shotsAgainst: 0,
        goalsAgainst: 0, savePct: 0, gaa: 0, wins: 0, losses: 0, otLosses: 0,
      };
      g.gp++;
      g.saves += l.glSaves;
      g.shotsAgainst += l.glShots;
      g.goalsAgainst += l.glGa;
      const game = gameById.get(l.matchId);
      if (game?.outcome === "W") g.wins++;
      else if (game?.outcome === "L") {
        if (game.overtime) g.otLosses++;
        else g.losses++;
      }
      goalies.set(l.eaPlayerId, g);
    } else {
      const s = skaters.get(l.eaPlayerId) ?? emptySkater(l.eaPlayerId);
      s.gp++;
      s.goals += l.goals;
      s.assists += l.assists;
      s.plusMinus += l.plusMinus;
      s.shots += l.shots;
      s.hits += l.hits;
      s.pim += l.pim;
      s.takeaways += l.takeaways;
      s.giveaways += l.giveaways;
      s.ppg += l.ppg;
      s.shg += l.shg;
      s.gwg += l.gwg;
      s.blockedShots += l.blockedShots;
      s.interceptions += l.interceptions;
      s.passAttempts += l.passAttempts;
      s.passes += l.passes;
      s.positions[l.position] = (s.positions[l.position] ?? 0) + 1;
      skaters.set(l.eaPlayerId, s);
    }
  }

  for (const e of extras) {
    const s = skaters.get(e.eaPlayerId) ?? emptySkater(e.eaPlayerId);
    s.gp += e.gp;
    s.goals += e.goals;
    s.assists += e.assists;
    s.plusMinus += e.plusMinus;
    s.shots += e.shots;
    s.hits += e.hits;
    s.pim += e.pim;
    s.takeaways += e.takeaways;
    s.giveaways += e.giveaways;
    s.ppg += e.ppg;
    s.shg += e.shg;
    s.blockedShots += e.blockedShots;
    s.interceptions += e.interceptions;
    s.passAttempts += e.passAttempts;
    s.passes += e.passes;
    skaters.set(e.eaPlayerId, s);
  }

  const skaterList = [...skaters.values()].map((s) => ({
    ...s,
    name: meta.get(s.eaPlayerId)!.name,
    badge: badgeOf(s.eaPlayerId),
    points: s.goals + s.assists,
    shotPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    passPct: s.passAttempts ? (s.passes / s.passAttempts) * 100 : 0,
    pointsPerGame: s.gp ? (s.goals + s.assists) / s.gp : 0,
  }));
  skaterList.sort((a, b) => b.points - a.points || b.goals - a.goals);

  const goalieList = [...goalies.values()].map((g) => ({
    ...g,
    name: meta.get(g.eaPlayerId)!.name,
    badge: badgeOf(g.eaPlayerId),
    savePct: g.shotsAgainst ? g.saves / g.shotsAgainst : 0,
    gaa: g.gp ? g.goalsAgainst / g.gp : 0,
  }));
  goalieList.sort((a, b) => b.savePct - a.savePct || b.gp - a.gp);

  return { skaters: skaterList, goalies: goalieList };
}

const DAY = 86_400_000;

// Extra stats are one lump per player, so a date range counts them only if it reaches their oldest game.
export function extrasInRange(extras: ExtraStats[], range: "all" | "30d" | "last10", now: Date): ExtraStats[] {
  if (range === "all") return extras;
  if (range === "30d") return extras.filter((e) => now.getTime() - e.coversFrom.getTime() <= 30 * DAY);
  return [];
}

export function filterGames(games: GameLite[], filter: "all" | "30d" | "last10", now: Date): Set<string> {
  if (filter === "30d") {
    return new Set(games.filter((g) => now.getTime() - g.playedAt.getTime() <= 30 * DAY).map((g) => g.matchId));
  }
  if (filter === "last10") {
    return new Set(
      games
        .filter((g) => g.source === "full")
        .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
        .slice(0, 10)
        .map((g) => g.matchId),
    );
  }
  return new Set(games.map((g) => g.matchId));
}

export function hotPlayers(
  lines: PlayerLine[],
  games: GameLite[],
  ourClubId: number,
  n = 5,
): { eaPlayerId: string; name: string; position: string; goals: number; assists: number; points: number; gp: number }[] {
  const recent = new Set(
    games
      .filter((g) => g.source === "full")
      .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
      .slice(0, n)
      .map((g) => g.matchId),
  );
  const { skaters } = playerTotals(lines.filter((l) => recent.has(l.matchId)), games, null, ourClubId);
  return skaters.slice(0, 3).map((s) => ({
    eaPlayerId: s.eaPlayerId,
    name: s.name,
    position: Object.entries(s.positions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
    goals: s.goals,
    assists: s.assists,
    points: s.points,
    gp: s.gp,
  }));
}

import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type Combo = { names: string[]; gp: number; wins: number; losses: number; otLosses: number; winPct: number; gfPerGame: number; gaPerGame: number };

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

type Acc = { names: string[]; gp: number; wins: number; otLosses: number; gf: number; ga: number };

function add(map: Map<string, Acc>, names: string[], g: GameLite) {
  const sorted = [...names].sort(byName);
  const key = sorted.join("|");
  const a = map.get(key) ?? { names: sorted, gp: 0, wins: 0, otLosses: 0, gf: 0, ga: 0 };
  a.gp++;
  a.wins += g.outcome === "W" ? 1 : 0;
  a.otLosses += g.outcome === "L" && g.overtime ? 1 : 0;
  a.gf += g.goalsFor;
  a.ga += g.goalsAgainst;
  map.set(key, a);
}

const finish = (map: Map<string, Acc>, minGames: number): Combo[] =>
  [...map.values()]
    .filter((a) => a.gp >= minGames)
    .map((a) => ({ names: a.names, gp: a.gp, wins: a.wins, losses: a.gp - a.wins - a.otLosses, otLosses: a.otLosses, winPct: a.wins / a.gp, gfPerGame: a.gf / a.gp, gaPerGame: a.ga / a.gp }))
    .sort((x, y) => y.winPct - x.winPct || y.gp - x.gp);

// Forward trios (one C, one LW, one RW) and D-pairs that played full games together.
export function chemistry(lines: PlayerLine[], games: GameLite[], ourClubId: number, minGames = 3): { trios: Combo[]; pairs: Combo[] } {
  const trios = new Map<string, Acc>();
  const pairs = new Map<string, Acc>();
  for (const g of games) {
    if (g.source !== "full") continue;
    const ours = lines.filter((l) => l.matchId === g.matchId && l.clubId === ourClubId);
    const at = (pos: string) => ours.filter((l) => l.position === pos).map((l) => l.playerName);
    const [c, lw, rw, d] = [at("center"), at("leftWing"), at("rightWing"), at("defenseMen")];
    if (c.length === 1 && lw.length === 1 && rw.length === 1) add(trios, [...c, ...lw, ...rw], g);
    if (d.length === 2) add(pairs, d, g);
  }
  return { trios: finish(trios, minGames), pairs: finish(pairs, minGames) };
}

// Team win % with and without each player (full games only).
export function withWithout(
  lines: PlayerLine[],
  games: GameLite[],
  ourClubId: number,
  minGames = 3,
): { name: string; withPct: number; withGp: number; withoutPct: number | null; withoutGp: number }[] {
  const full = games.filter((g) => g.source === "full");
  const played = new Map<string, { name: string; ids: Set<string> }>();
  for (const l of lines) {
    if (l.clubId !== ourClubId) continue;
    const p = played.get(l.eaPlayerId) ?? { name: l.playerName, ids: new Set<string>() };
    p.ids.add(l.matchId);
    p.name = l.playerName;
    played.set(l.eaPlayerId, p);
  }
  const pct = (list: GameLite[]) => list.filter((g) => g.outcome === "W").length / list.length;
  return [...played.values()]
    .filter((p) => p.ids.size >= minGames)
    .map((p) => {
      const withG = full.filter((g) => p.ids.has(g.matchId));
      const without = full.filter((g) => !p.ids.has(g.matchId));
      return { name: p.name, withPct: pct(withG), withGp: withG.length, withoutPct: without.length ? pct(without) : null, withoutGp: without.length };
    })
    .sort((a, b) => {
      if (a.withoutPct === null) return 1;
      if (b.withoutPct === null) return -1;
      return b.withPct - b.withoutPct - (a.withPct - a.withoutPct);
    });
}

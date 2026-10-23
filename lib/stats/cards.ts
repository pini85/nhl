import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type Tier = "gold" | "silver" | "bronze";
export type PlayerCard =
  | { kind: "skater"; ovr: number; off: number; def: number; team: number; sho: number; phy: number; ply: number; tier: Tier; gp: number }
  | { kind: "goalie"; ovr: number; gaa: number; gp: number; tier: Tier };

const MIN_GAMES = 3;
const clamp = (n: number) => Math.max(0, Math.min(99, Math.round(n)));
const tierOf = (ovr: number): Tier => (ovr >= 85 ? "gold" : ovr >= 75 ? "silver" : "bronze");

// FUT-style card from EA's own per-game ratings (full games for our club only).
export function playerCard(lines: PlayerLine[], games: GameLite[], eaPlayerId: string): PlayerCard | null {
  const full = new Set(games.filter((g) => g.source === "full").map((g) => g.matchId));
  const mine = lines.filter((l) => l.eaPlayerId === eaPlayerId && full.has(l.matchId));
  const skater = mine.filter((l) => l.position !== "goalie");
  const goalie = mine.filter((l) => l.position === "goalie");

  if (skater.length >= MIN_GAMES && skater.length >= goalie.length) {
    const n = skater.length;
    const avg = (f: (l: PlayerLine) => number) => skater.reduce((s, l) => s + f(l), 0) / n;
    const off = Math.round(avg((l) => l.ratingOffense));
    const def = Math.round(avg((l) => l.ratingDefense));
    const team = Math.round(avg((l) => l.ratingTeamplay));
    const goals = skater.reduce((s, l) => s + l.goals, 0);
    const shots = skater.reduce((s, l) => s + l.shots, 0);
    const passAttempts = skater.reduce((s, l) => s + l.passAttempts, 0);
    const passes = skater.reduce((s, l) => s + l.passes, 0);
    const ovr = Math.round((off + def + team) / 3);
    return {
      kind: "skater",
      ovr,
      off,
      def,
      team,
      sho: clamp((shots ? (goals / shots) * 100 : 0) * 2 + (shots / n) * 5),
      phy: clamp(avg((l) => l.hits) * 12),
      ply: clamp(avg((l) => l.assists) * 30 + (passAttempts ? (passes / passAttempts) * 100 : 0) * 0.3),
      tier: tierOf(ovr),
      gp: n,
    };
  }
  if (goalie.length >= MIN_GAMES) {
    const saves = goalie.reduce((s, l) => s + l.glSaves, 0);
    const faced = goalie.reduce((s, l) => s + l.glShots, 0);
    const ovr = faced ? Math.round((saves / faced) * 100) : 0;
    return { kind: "goalie", ovr, gaa: goalie.reduce((s, l) => s + l.glGa, 0) / goalie.length, gp: goalie.length, tier: tierOf(ovr) };
  }
  return null;
}

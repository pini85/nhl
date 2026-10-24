import { playerTotals } from "@/lib/stats/players";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type FunFact = { key: string; text: string; score: number };

const MIN_GAMES = 3;
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hourCycle: "h23" });

// Auto-generated "Did you know?" facts, most interesting first. Nothing on fewer than 3 games.
export function funFacts(lines: PlayerLine[], games: GameLite[], ourClubId: number): FunFact[] {
  const full = games.filter((g) => g.source === "full");
  if (full.length < MIN_GAMES) return [];
  const facts: FunFact[] = [];
  const outcome = new Map(games.map((g) => [g.matchId, g.outcome]));
  const { skaters: allSkaters, goalies } = playerTotals(lines, games, null, ourClubId);
  // Every player-based fact needs at least 3 games from that player.
  const skaters = allSkaters.filter((s) => s.gp >= MIN_GAMES);

  // Team record when a player gets on the scoresheet (top 2 scorers with 3+ such games).
  for (const s of skaters.slice(0, 2)) {
    const scored = lines.filter((l) => l.eaPlayerId === s.eaPlayerId && l.goals + l.assists > 0);
    if (scored.length < MIN_GAMES) continue;
    const w = scored.filter((l) => outcome.get(l.matchId) === "W").length;
    facts.push({ key: `when-${s.eaPlayerId}`, text: `Team record when ${s.name} gets a point: ${w}-${scored.length - w}`, score: 60 + (w / scored.length) * 30 });
  }

  const shooter = skaters.filter((s) => s.shots >= 10).sort((a, b) => b.shotPct - a.shotPct)[0];
  if (shooter) facts.push({ key: "shooter", text: `${shooter.name} scores on ${Math.round(shooter.shotPct)}% of shots`, score: 50 + shooter.shotPct });

  const passer = skaters.filter((s) => s.passAttempts >= 100).sort((a, b) => b.passPct - a.passPct)[0];
  if (passer) facts.push({ key: "passer", text: `${passer.name} completes ${Math.round(passer.passPct)}% of passes`, score: 48 + passer.passPct / 5 });

  const hitter = [...skaters].sort((a, b) => b.hits - a.hits)[0];
  if (hitter && hitter.hits >= 10) facts.push({ key: "hits", text: `${hitter.name} has thrown ${hitter.hits} hits`, score: 55 + Math.min(30, hitter.hits / 2) });

  const guest = skaters.filter((s) => s.badge === "guest" && s.gp >= MIN_GAMES).sort((a, b) => b.points - a.points)[0];
  if (guest && guest.points > 0) facts.push({ key: "guest", text: `Guest of honor: ${guest.name} with ${guest.points} points`, score: 65 + Math.min(20, guest.points) });

  const goalie = goalies.filter((g) => g.gp >= MIN_GAMES)[0];
  if (goalie) facts.push({ key: "goalie", text: `${goalie.name} stops ${goalie.savePct.toFixed(3).replace(/^0/, "")} of shots in net`, score: 45 + goalie.savePct * 20 });

  const blowouts = games.filter((g) => g.outcome === "W" && g.goalsFor - g.goalsAgainst >= 4).length;
  if (blowouts >= 2) facts.push({ key: "blowouts", text: `${blowouts} wins by 4 goals or more`, score: 50 + blowouts * 5 });

  const opponents = new Map<number, { name: string | null; n: number }>();
  for (const g of games) {
    const o = opponents.get(g.opponentClubId) ?? { name: g.opponentName, n: 0 };
    o.n++;
    o.name ??= g.opponentName;
    opponents.set(g.opponentClubId, o);
  }
  const rival = [...opponents.values()].sort((a, b) => b.n - a.n)[0];
  if (rival && rival.n >= MIN_GAMES && rival.name) facts.push({ key: "rival", text: `Most played: ${rival.name}, ${rival.n} times`, score: 55 + rival.n * 3 });

  const late = full.filter((g) => Number(hourFmt.format(g.playedAt)) >= 23 || Number(hourFmt.format(g.playedAt)) < 4);
  if (late.length >= MIN_GAMES) {
    const w = late.filter((g) => g.outcome === "W").length;
    facts.push({ key: "late", text: `After 23:00 the team goes ${w}-${late.length - w}`, score: 58 });
  }

  return facts.sort((a, b) => b.score - a.score);
}

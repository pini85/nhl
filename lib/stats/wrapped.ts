import type { MatchClubRow } from "@/lib/ea/normalize";
import { allAwards } from "@/lib/stats/awards";
import { groupGameNights } from "@/lib/stats/nights";
import { headToHead, nemesis } from "@/lib/stats/opponents";
import { playerTotals } from "@/lib/stats/players";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";

export type Slide = { kind: string; eyebrow: string; big: string; title?: string; line: string };

// Story slides for /wrapped, built from the archive (all time).
export function buildWrapped(
  games: GameLite[],
  lines: PlayerLine[],
  clubs: MatchClubRow[],
  ourClubId: number,
  extras: ExtraStats[] = [],
): { slides: Slide[] } {
  if (!games.length) return { slides: [] };
  const wins = games.filter((g) => g.outcome === "W").length;
  const gf = games.reduce((s, g) => s + g.goalsFor, 0);
  const ga = games.reduce((s, g) => s + g.goalsAgainst, 0);
  const { skaters } = playerTotals(lines, games, null, ourClubId, extras);
  const slides: Slide[] = [
    { kind: "games", eyebrow: "Games played", big: String(games.length), line: `${wins} wins · ${games.length - wins} losses` },
    { kind: "goals", eyebrow: "Goals scored", big: String(gf), line: `${ga} allowed · ${gf - ga >= 0 ? "+" : ""}${gf - ga} difference` },
  ];

  const scorer = skaters[0];
  if (scorer) slides.push({ kind: "scorer", eyebrow: "Top scorer", big: String(scorer.points), title: scorer.name, line: `${scorer.goals} goals · ${scorer.assists} assists` });

  const hitter = [...skaters].sort((a, b) => b.hits - a.hits)[0];
  if (hitter && hitter.hits > 0) slides.push({ kind: "hits", eyebrow: "Hit machine", big: String(hitter.hits), title: hitter.name, line: "hits thrown. Nobody skated through." });

  const best = groupGameNights(games).sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst))[0];
  if (best) slides.push({ kind: "night", eyebrow: "Best game night", big: `${best.wins}-${best.losses}`, title: best.label, line: `${best.goalsFor} goals for, ${best.goalsAgainst} against` });

  const h2h = headToHead(games);
  // Only a real nemesis: a club we've lost to more than we've beaten.
  const foe = nemesis(h2h, 1).find((h) => h.losses > h.wins);
  if (foe) {
    slides.push({ kind: "nemesis", eyebrow: "Nemesis", big: `${foe.wins}-${foe.losses}`, title: foe.name ?? `Club ${foe.clubId}`, line: "Revenge is on the schedule." });
  } else {
    const most = [...h2h].sort((a, b) => b.gp - a.gp || b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime())[0];
    if (most) slides.push({ kind: "most-played", eyebrow: "Clubs faced", big: String(h2h.length), title: `Latest rival: ${most.name ?? `Club ${most.clubId}`}`, line: `${most.wins}-${most.losses} against them` });
  }

  const awards = allAwards(lines, games, clubs, ourClubId);
  const byPlayer = new Map<string, { name: string; n: number }>();
  for (const a of awards) {
    const e = byPlayer.get(a.eaPlayerId) ?? { name: a.name, n: 0 };
    e.n++;
    byPlayer.set(a.eaPlayerId, e);
  }
  const decorated = [...byPlayer.values()].sort((a, b) => b.n - a.n)[0];
  if (decorated) slides.push({ kind: "awards", eyebrow: "Most decorated", big: String(decorated.n), title: decorated.name, line: "awards and badges earned" });

  slides.push({ kind: "outro", eyebrow: "Drop drop drop", big: "🏒", line: "See you on the ice." });
  return { slides };
}

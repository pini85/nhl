import type { MatchClubRow } from "@/lib/ea/normalize";
import { groupGameNights, nightMvp } from "@/lib/stats/nights";
import type { GameLite, PlayerLine } from "@/lib/stats/types";

export type AwardKey =
  | "hattrick"
  | "playmaker"
  | "sniper"
  | "bruiser"
  | "brickwall"
  | "shutout"
  | "plus"
  | "pickpocket"
  | "giantslayer"
  | "nightmvp";

export type Award = { key: AwardKey; emoji: string; label: string; eaPlayerId: string; name: string; matchId: string | null; nightKey: string | null };

export const AWARD_INFO: Record<AwardKey, { emoji: string; label: string; hint: string }> = {
  hattrick: { emoji: "🎩", label: "Hat trick", hint: "3+ goals in a game" },
  playmaker: { emoji: "🎯", label: "Playmaker", hint: "3+ assists in a game" },
  sniper: { emoji: "🔫", label: "Sniper", hint: "2+ goals on half your shots or better" },
  bruiser: { emoji: "💥", label: "Bruiser", hint: "6+ hits in a game" },
  brickwall: { emoji: "🧤", label: "Brick wall", hint: "Goalie: .900+ on 15+ shots" },
  shutout: { emoji: "🔒", label: "Shutout", hint: "Goalie: no goals on 5+ shots" },
  plus: { emoji: "➕", label: "Mr. Plus", hint: "+4 or better in a game" },
  pickpocket: { emoji: "🕵️", label: "Pickpocket", hint: "4+ takeaways in a game" },
  giantslayer: { emoji: "🗡️", label: "Giant slayer", hint: "Beat a club from a higher division" },
  nightmvp: { emoji: "⭐", label: "Night MVP", hint: "Most points on a game night" },
};

// EA stores a game's club division on a reversed scale: 11 − season division (Div 1 = 10).
export function seasonDivisionFromMatch(matchDivision: number): number {
  return 11 - matchDivision;
}

const make = (key: AwardKey, l: { eaPlayerId: string; playerName: string }, matchId: string | null, nightKey: string | null): Award => ({
  key,
  emoji: AWARD_INFO[key].emoji,
  label: AWARD_INFO[key].label,
  eaPlayerId: l.eaPlayerId,
  name: l.playerName,
  matchId,
  nightKey,
});

export function gameAwards(lines: PlayerLine[], game: GameLite, clubs: MatchClubRow[], ourClubId: number): Award[] {
  if (game.source !== "full") return [];
  const ours = lines.filter((l) => l.matchId === game.matchId && l.clubId === ourClubId);
  const awards: Award[] = [];
  const us = clubs.find((c) => c.clubId === ourClubId);
  const them = clubs.find((c) => c.clubId === game.opponentClubId);
  // Higher stored number = higher division (reversed scale).
  const giant = game.outcome === "W" && !!us && !!them && us.division > 0 && them.division > us.division;

  for (const l of ours) {
    if (l.position === "goalie") {
      if (l.glShots >= 15 && l.glSaves / l.glShots >= 0.9) awards.push(make("brickwall", l, game.matchId, null));
      if (l.glGa === 0 && l.glShots >= 5) awards.push(make("shutout", l, game.matchId, null));
      continue;
    }
    if (l.goals >= 3) awards.push(make("hattrick", l, game.matchId, null));
    if (l.assists >= 3) awards.push(make("playmaker", l, game.matchId, null));
    if (l.goals >= 2 && l.shots > 0 && l.goals / l.shots >= 0.5) awards.push(make("sniper", l, game.matchId, null));
    if (l.hits >= 6) awards.push(make("bruiser", l, game.matchId, null));
    if (l.plusMinus >= 4) awards.push(make("plus", l, game.matchId, null));
    if (l.takeaways >= 4) awards.push(make("pickpocket", l, game.matchId, null));
    if (giant) awards.push(make("giantslayer", l, game.matchId, null));
  }
  return awards;
}

export function allAwards(lines: PlayerLine[], games: GameLite[], clubs: MatchClubRow[], ourClubId: number): Award[] {
  const clubsByMatch = new Map<string, MatchClubRow[]>();
  for (const c of clubs) clubsByMatch.set(c.matchId, [...(clubsByMatch.get(c.matchId) ?? []), c]);
  const linesByMatch = new Map<string, PlayerLine[]>();
  for (const l of lines) linesByMatch.set(l.matchId, [...(linesByMatch.get(l.matchId) ?? []), l]);

  const out: Award[] = [];
  for (const g of games) out.push(...gameAwards(linesByMatch.get(g.matchId) ?? [], g, clubsByMatch.get(g.matchId) ?? [], ourClubId));
  for (const night of groupGameNights(games)) {
    const nightLines = night.games.flatMap((g) => linesByMatch.get(g.matchId) ?? []);
    const mvp = nightMvp(nightLines, ourClubId);
    if (mvp && mvp.points > 0) out.push(make("nightmvp", { eaPlayerId: mvp.eaPlayerId, playerName: mvp.playerName }, null, night.key));
  }
  return out;
}

export function badgeCabinet(awards: Award[], eaPlayerId: string): { key: AwardKey; emoji: string; label: string; count: number }[] {
  const counts = new Map<AwardKey, number>();
  for (const a of awards) if (a.eaPlayerId === eaPlayerId) counts.set(a.key, (counts.get(a.key) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, emoji: AWARD_INFO[key].emoji, label: AWARD_INFO[key].label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

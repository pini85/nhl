import type { MatchSetup, PlayerInfo, TeamSetup } from "@/components/arcade/engine/types";
import type { ArcadeData, ArcadeGoalie, ArcadeOpponent, ArcadeSkater } from "@/lib/stats/arcade";

// Turns card ratings (60–99) into the engine's 0..1 and builds both teams for a match.

export const unit = (rating: number) => Math.max(0.05, Math.min(0.95, (rating - 60) / 40));

export function skaterInfo(s: ArcadeSkater, myId: string | null): PlayerInfo {
  return { id: s.id, name: s.name, number: s.number, skate: unit(s.r.skate), shot: unit(s.r.shot), pass: unit(s.r.pass), hit: unit(s.r.hit), save: 0.3, you: s.id === myId };
}

export function goalieInfo(g: ArcadeGoalie, myId: string | null): PlayerInfo {
  const v = unit(g.save);
  return { id: g.id, name: g.name, number: g.number, skate: 0.5, shot: 0.2, pass: 0.5, hit: 0.2, save: v, you: g.id === myId };
}

/** Default line: you first (if you're a regular), then the most-played regulars. */
export function defaultLineup(data: ArcadeData, myId: string | null): string[] {
  const ids = data.skaters.map((s) => s.id);
  const first = myId && ids.includes(myId) ? [myId] : [];
  return [...first, ...ids.filter((id) => id !== myId)].slice(0, 3);
}

/** A saved line-up, repaired if players left the list. */
export function validLineup(data: ArcadeData, saved: string[] | undefined, myId: string | null): string[] {
  const ids = new Set(data.skaters.map((s) => s.id));
  const keep = (saved ?? []).filter((id, i, a) => ids.has(id) && a.indexOf(id) === i).slice(0, 3);
  for (const id of defaultLineup(data, myId)) if (keep.length < 3 && !keep.includes(id)) keep.push(id);
  for (const s of data.skaters) if (keep.length < 3 && !keep.includes(s.id)) keep.push(s.id);
  return keep;
}

const CALL_UP: ArcadeSkater = { id: "call-up", name: "Call-up", number: 77, pos: "F", r: { skate: 70, shot: 70, pass: 70, hit: 70 }, ovr: 70, gp: 0, goals: 0, assists: 0, hits: 0 };

/** The opponent's AI level: harder for clubs that beat us more, and a little more at each tour stop. */
export const levelFor = (o: ArcadeOpponent, stop: number | null) => Math.min(0.95, 0.3 + 0.55 * o.difficulty + (stop ?? 0) * 0.03);

export function buildSetup(
  data: ArcadeData,
  opp: ArcadeOpponent,
  lineup: string[],
  goalieId: string | null,
  myId: string | null,
  opts: { insane: boolean; stop: number | null; seed: number; length?: number },
): MatchSetup {
  const byId = new Map(data.skaters.map((s) => [s.id, s]));
  const sk = lineup.map((id) => byId.get(id)).filter((s): s is ArcadeSkater => !!s);
  let k = 0;
  while (sk.length < 3) sk.push({ ...CALL_UP, id: `call-up-${k}`, name: `Call-up ${++k}`, number: 70 + k });
  const g = data.goalies.find((x) => x.id === goalieId) ?? data.goalies[0];
  const home: TeamSetup = { name: "Drop drop drop", abbr: "DDD", color: "#5cc8ff", skaters: sk.map((s) => skaterInfo(s, myId)), goalie: goalieInfo(g, myId), level: 0.62 };
  const away: TeamSetup = {
    name: opp.name,
    abbr: opp.abbr,
    color: opp.color,
    skaters: opp.skaters.map((s) => skaterInfo(s, null)),
    goalie: goalieInfo(opp.goalie, null),
    level: levelFor(opp, opts.stop),
  };
  return { home, away, seed: opts.seed, insane: opts.insane, length: opts.length ?? 180 };
}

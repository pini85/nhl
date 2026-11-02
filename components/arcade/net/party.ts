import type { MatchSetup, PlayerInfo, Seat, TeamSetup } from "@/components/arcade/engine/types";
import { RIVAL } from "@/components/arcade/net/snapshot";

// Online party games: up to 3 humans a side. The lobby (who sits where, who is ready) and the
// match each side skates out are worked out here, away from React, so they can be tested.

export const SIDE_MAX = 3;
export const PARTY_MAX = SIDE_MAX * 2;
/** Seconds the lobby waits, once a second phone is in, before the puck drops anyway. */
export const LOBBY_SECONDS = 120;

export type Side = 0 | 1; // 0 = left, 1 = right on the lobby screen

/** A phone in the room. `team` is the line it brought (its own players, its name). */
export type Member = { id: number; name: string; side: Side; ready: boolean; team: TeamSetup };

/** What the host tells every phone about the room. */
export type RoomInfo = { members: { id: number; name: string; side: Side; ready: boolean }[]; left: number | null; playing: boolean }; // left: null while the clock waits for a second phone

export const sideCount = (members: Member[], side: Side) => members.filter((m) => m.side === side).length;

/** A newcomer's side: the one with fewer people, left on a tie. Null when the room is full. */
export function openSide(members: Member[]): Side | null {
  const l = sideCount(members, 0);
  const r = sideCount(members, 1);
  if (l >= SIDE_MAX && r >= SIDE_MAX) return null;
  if (l >= SIDE_MAX) return 1;
  if (r >= SIDE_MAX) return 0;
  return r < l ? 1 : 0;
}

/** Everyone ready, and at least two people to play. */
export const allReady = (members: Member[]) => members.length >= 2 && members.every((m) => m.ready);

const unmark = (p: PlayerInfo): PlayerInfo => ({ ...p, you: false });

/**
 * One side's team. Each human skates as the first player of their own line not already taken;
 * the captain (first to sit) brings the goalie, the name, and the players for the empty spots.
 */
export function sideTeam(humans: TeamSetup[], ai: TeamSetup): TeamSetup {
  if (!humans.length) return { ...ai, skaters: ai.skaters.map(unmark), goalie: unmark(ai.goalie) };
  const used = new Set<string>();
  const take = (from: PlayerInfo[]) => {
    const p = from.find((x) => !used.has(x.id));
    if (p) used.add(p.id);
    return p;
  };
  const line: PlayerInfo[] = [];
  for (const h of humans.slice(0, SIDE_MAX)) {
    const p = take(h.skaters);
    if (p) line.push(p);
  }
  const pool = [humans[0].skaters, ...humans.slice(1).map((h) => h.skaters), ai.skaters];
  for (const from of pool) {
    while (line.length < SIDE_MAX) {
      const p = take(from);
      if (!p) break;
      line.push(p);
    }
  }
  const captain = humans[0];
  return { ...captain, skaters: line.slice(0, SIDE_MAX).map(unmark), goalie: unmark(captain.goalie) };
}

/**
 * The host's match. The host's side is home (team 0) whichever side of the lobby it sat on,
 * so the host never has to turn its own view around. Seats come back in `members` order.
 */
export function partySetup(members: Member[], ai: TeamSetup, opts: { seed: number; insane: boolean; length?: number }): MatchSetup {
  const hostSide = members[0].side;
  const teamOf = (m: Member): 0 | 1 => (m.side === hostSide ? 0 : 1);
  const seats: Seat[] = [];
  const count = [0, 0];
  for (const m of members) {
    const t = teamOf(m);
    seats.push({ team: t, slot: Math.min(SIDE_MAX - 1, count[t]++) });
  }
  const humans = (t: 0 | 1) => members.filter((m) => teamOf(m) === t).map((m) => m.team);
  const home = sideTeam(humans(0), ai);
  const away = sideTeam(humans(1), ai);
  return {
    home: { ...home, color: members[0].team.color },
    away: { ...away, color: RIVAL },
    seed: opts.seed,
    insane: opts.insane,
    length: opts.length ?? 180,
    versus: true,
    party: seats,
  };
}

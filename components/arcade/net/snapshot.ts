import { z } from "zod";
import type { Action, GameEvent, Input, MatchSetup, MatchState, Phase, TeamSetup } from "@/components/arcade/engine/types";

// Online play: the host runs the match and streams compact snapshots; the guest only draws them.
// The guest sees the rink turned 180° with the teams swapped, so on both phones "you" are the
// home team attacking up the screen and the renderers need no changes.

export type Snap = {
  n: number; // sequence number, newest wins
  t: number;
  c: number; // clock
  ot: boolean;
  ph: Phase;
  pt: number; // phaseT
  sc: [number, number];
  sog: [number, number];
  ctl: [number, number];
  fire: number[];
  ts: number; // timeScale
  fz: number; // freeze
  lg: MatchState["lastGoal"];
  sk: number[]; // SK_FIELDS numbers per skater
  pk: number[]; // PK_FIELDS numbers per puck
};

const SK_FIELDS = 16;
const PK_FIELDS = 8;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function encode(state: MatchState, n: number): Snap {
  const sk: number[] = [];
  for (const s of state.skaters) {
    sk.push(r3(s.x), r3(s.y), r3(s.vx), r3(s.vy), r3(s.face), r3(s.stun), r3(s.stamina), s.burst ? 1 : 0, r3(s.dash), r3(s.poke), r3(s.charge), s.goals, s.assists, s.shots, s.hits, s.saves);
  }
  const pk: number[] = [];
  for (const p of state.pucks) pk.push(r3(p.x), r3(p.y), r3(p.z), r3(p.vx), r3(p.vy), r3(p.vz), p.owner, p.shotBy);
  return {
    n,
    t: r3(state.t),
    c: r3(state.clock),
    ot: state.ot,
    ph: state.phase,
    pt: r3(state.phaseT),
    sc: [...state.score],
    sog: [...state.sog],
    ctl: [state.pilots[0].controlled, state.pilots[1].controlled],
    fire: [...state.onFire],
    ts: state.timeScale,
    fz: r3(state.freeze),
    lg: state.lastGoal && { ...state.lastGoal },
    sk,
    pk,
  };
}

/** Index of a skater on the other side of the mirror: the teams swap places in the list. */
const swapIdx = (i: number, n: number) => (i < 0 ? i : (i + n / 2) % n);
const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
const swap2 = <T>(a: [T, T]): [T, T] => [a[1], a[0]];

/**
 * Writes a snapshot into a view state, turned for the guest when `mirror`. `ahead` seconds of
 * extrapolation along each velocity smooth out the gaps between snapshots.
 */
export function apply(view: MatchState, snap: Snap, mirror: boolean, ahead = 0) {
  const n = view.skaters.length;
  const f = mirror ? -1 : 1;
  const idx = (i: number) => (mirror ? swapIdx(i, n) : i);
  const moving = snap.ph === "play" || snap.ph === "goal";
  const dt = moving && snap.fz <= 0 ? ahead * snap.ts : 0;
  for (let k = 0; k < n; k++) {
    const s = view.skaters[idx(k)];
    const o = k * SK_FIELDS;
    const a = snap.sk;
    s.vx = a[o + 2] * f;
    s.vy = a[o + 3] * f;
    s.x = a[o] * f + s.vx * dt;
    s.y = a[o + 1] * f + s.vy * dt;
    s.face = a[o + 4] + (mirror ? Math.PI : 0);
    s.stun = a[o + 5];
    s.stamina = a[o + 6];
    s.burst = a[o + 7] === 1;
    s.dash = a[o + 8];
    s.poke = a[o + 9];
    s.charge = a[o + 10];
    s.goals = a[o + 11];
    s.assists = a[o + 12];
    s.shots = a[o + 13];
    s.hits = a[o + 14];
    s.saves = a[o + 15];
  }
  const count = snap.pk.length / PK_FIELDS;
  for (let k = 0; k < count && k < view.pucks.length; k++) {
    const p = view.pucks[k];
    const o = k * PK_FIELDS;
    const a = snap.pk;
    p.vx = a[o + 3] * f;
    p.vy = a[o + 4] * f;
    p.x = a[o] * f + p.vx * dt;
    p.y = a[o + 1] * f + p.vy * dt;
    p.z = a[o + 2];
    p.vz = a[o + 5];
    p.owner = idx(a[o + 6]);
    p.shotBy = idx(a[o + 7]);
    // The guest keeps its own short trail of drawn positions.
    p.trail.push({ x: p.x, y: p.y, z: p.z });
    if (p.trail.length > 10) p.trail.shift();
  }
  view.t = snap.t + dt;
  view.clock = snap.c;
  view.ot = snap.ot;
  view.phase = snap.ph;
  view.phaseT = snap.pt + ahead;
  view.score = mirror ? swap2(snap.sc) : [...snap.sc];
  view.sog = mirror ? swap2(snap.sog) : [...snap.sog];
  const ctl = mirror ? swap2(snap.ctl) : snap.ctl;
  view.pilots[0].controlled = idx(ctl[0]);
  view.pilots[1].controlled = idx(ctl[1]);
  view.onFire = snap.fire.map(idx);
  view.timeScale = snap.ts;
  view.freeze = 0; // the host already holds the hit-stop
  view.lastGoal = snap.lg && (mirror ? { team: other(snap.lg.team), scorer: idx(snap.lg.scorer), x: -snap.lg.x, y: -snap.lg.y } : { ...snap.lg });
}

/** An event from the host, turned for the guest's view. */
export function mirrorEvent(e: GameEvent, n: number): GameEvent {
  const i = (k: number) => swapIdx(k, n);
  switch (e.kind) {
    case "shot":
      return { ...e, x: -e.x, y: -e.y, by: i(e.by) };
    case "pass":
      return { ...e, by: i(e.by), to: i(e.to) };
    case "hit":
      return { ...e, x: -e.x, y: -e.y, by: i(e.by), victim: i(e.victim) };
    case "poke":
    case "save":
    case "block":
      return { ...e, x: -e.x, y: -e.y, by: i(e.by) };
    case "post":
    case "boards":
      return { ...e, x: -e.x, y: -e.y };
    case "goal":
      return { ...e, team: other(e.team), scorer: i(e.scorer), assists: e.assists.map(i), x: -e.x, y: -e.y };
    case "fire":
      return { ...e, who: i(e.who) };
    case "end":
      return { ...e, winner: other(e.winner) };
    case "switch":
      return { ...e, to: i(e.to) };
    case "steal":
      return { ...e, by: i(e.by) };
    default:
      return e;
  }
}

/** The opponent's jersey on both phones; your own team is always the home blue. */
export const RIVAL = "#ff3d6e";

const notYou = (t: TeamSetup): TeamSetup => ({ ...t, color: RIVAL, skaters: t.skaters.map((p) => ({ ...p, you: false })), goalie: { ...t.goalie, you: false } });

/** The host's match: host at home, guest away. */
export function versusSetup(host: TeamSetup, guest: TeamSetup, opts: { seed: number; insane: boolean; length?: number }): MatchSetup {
  return { home: host, away: notYou(guest), seed: opts.seed, insane: opts.insane, length: opts.length ?? 180, versus: true };
}

/** The same match as the guest sees it: their team at home. Their own `you` marks come from their team as they sent it. */
export function guestView(setup: MatchSetup, mine: TeamSetup): MatchSetup {
  return { ...setup, home: { ...mine, color: setup.home.color }, away: notYou(setup.home) };
}

const clamp = (v: unknown, lim = 1) => Math.max(-lim, Math.min(lim, Number(v) || 0));
const neg = (v: number) => (v === 0 ? 0 : -v);

/** A guest's input as it came over the wire: checked, and turned back into the host's world. */
export function guestInput(m: Record<string, unknown>): Input {
  const actions: Action[] = [];
  for (const a of Array.isArray(m.actions) ? m.actions.slice(0, 8) : []) {
    const k = (a as { kind?: unknown })?.kind;
    if (k === "tap" || k === "charge" || k === "release") actions.push({ kind: k });
    else if (k === "swipe") {
      const w = a as { dx?: unknown; dy?: unknown; power?: unknown };
      actions.push({ kind: "swipe", dx: neg(clamp(w.dx, 1e4)), dy: neg(clamp(w.dy, 1e4)), power: Math.max(0, Math.min(1, Number(w.power) || 0)) });
    }
  }
  return { mx: neg(clamp(m.mx)), my: neg(clamp(m.my)), burst: !!m.burst, actions };
}

// What the other phone sends is checked before it reaches the engine.
const unitNum = z.number().finite().transform((v) => Math.max(0, Math.min(1, v)));
const Player = z.object({
  id: z.string().max(64),
  name: z.string().max(40),
  number: z.number().int().min(0).max(99),
  skate: unitNum,
  shot: unitNum,
  pass: unitNum,
  hit: unitNum,
  save: unitNum,
  you: z.boolean().optional(),
});
const Team = z.object({
  name: z.string().max(40),
  abbr: z.string().max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  skaters: z.array(Player).length(3),
  goalie: Player,
  level: unitNum,
});
const Setup = z.object({
  home: Team,
  away: Team,
  seed: z.number().int(),
  insane: z.boolean(),
  length: z.number().min(10).max(600),
  versus: z.literal(true),
});

export const readTeam = (x: unknown): TeamSetup | null => Team.safeParse(x).data ?? null;
export const readSetup = (x: unknown): MatchSetup | null => Setup.safeParse(x).data ?? null;

import { RINK } from "@/components/arcade/engine/rink";
import { makeRng } from "@/components/arcade/engine/rng";
import type { MatchSetup, MatchState, PlayerInfo, Puck, Skater } from "@/components/arcade/engine/types";

export const SK_R = 0.9;
export const G_R = 0.95;
export const PUCK_R = 0.22;
export const REACH = 0.62; // stick blade distance beyond the body

/** +1 when the team attacks the top goal. */
export const dirOf = (team: 0 | 1) => (team === 0 ? 1 : -1);
export const goalYOf = (team: 0 | 1) => dirOf(team) * RINK.goalY; // the goal this team shoots at

export const stickX = (s: Skater) => s.x + Math.cos(s.face) * (s.r + REACH);
export const stickY = (s: Skater) => s.y + Math.sin(s.face) * (s.r + REACH);

export function maxSpeed(state: MatchState, s: Skater): number {
  let v = 8.2 + 4 * s.info.skate;
  if (s.goalie) return 2.6 + 4.2 * s.info.save;
  if (state.pucks.some((p) => p.owner === s.i)) v *= 0.9;
  if (s.burst) v *= 1.32;
  if (s.charge >= 0) v *= 0.45;
  if (state.onFire.includes(s.i)) v *= 1.08;
  return v;
}

export const accelOf = (s: Skater) => (s.goalie ? 40 : 24 + 14 * s.info.skate);

function newSkater(i: number, team: 0 | 1, info: PlayerInfo, goalie: boolean): Skater {
  return {
    i, team, goalie, info, x: 0, y: 0, vx: 0, vy: 0, face: team === 0 ? Math.PI / 2 : -Math.PI / 2,
    r: goalie ? G_R : SK_R, stun: 0, stamina: 1, burst: false, dash: -1, dashX: 0, dashY: 0, poke: -1, pickupCd: 0,
    charge: -1, recvT: 9, think: 0, tx: 0, ty: 0, speedMul: 1, holdT: 0, goals: 0, assists: 0, shots: 0, hits: 0, saves: 0,
  };
}

export function newPuck(x = 0, y = 0): Puck {
  return { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, passTo: -1, shotBy: -1, oneTimer: false, chain: [], trail: [] };
}

export function createMatch(setup: MatchSetup): MatchState {
  const skaters: Skater[] = [];
  for (const team of [0, 1] as const) {
    const t = team === 0 ? setup.home : setup.away;
    for (const info of t.skaters.slice(0, 3)) skaters.push(newSkater(skaters.length, team, info, false));
    skaters.push(newSkater(skaters.length, team, t.goalie, true));
  }
  const state: MatchState = {
    setup,
    rng: makeRng(setup.seed),
    t: 0,
    clock: setup.length,
    ot: false,
    phase: "faceoff",
    phaseT: 0,
    score: [0, 0],
    sog: [0, 0],
    skaters,
    pucks: [],
    controlled: 0,
    switchLock: 0,
    fireRun: [{ who: -1, n: 0 }, { who: -1, n: 0 }],
    onFire: [],
    events: [],
    freeze: 0,
    timeScale: 1,
    lastGoal: null,
  };
  faceoff(state, 0);
  return state;
}

/** Puts everyone on their faceoff spots. `lostLast` gets the first touch advantage (the team scored on). */
export function faceoff(state: MatchState, lostLast: 0 | 1) {
  const spots = [
    [0, -1.6],
    [-6.5, -4],
    [5.5, -8],
  ];
  for (const s of state.skaters) {
    const d = dirOf(s.team);
    const k = state.skaters.filter((o) => o.team === s.team && !o.goalie).indexOf(s);
    if (s.goalie) {
      s.x = 0;
      s.y = -d * (RINK.goalY - 1.6);
    } else {
      s.x = spots[k][0] * d;
      s.y = spots[k][1] * d + (k === 0 && s.team === lostLast ? 0.25 * d : 0);
    }
    s.vx = s.vy = 0;
    s.face = d > 0 ? Math.PI / 2 : -Math.PI / 2;
    s.stun = 0;
    s.dash = -1;
    s.poke = -1;
    s.charge = -1;
    s.burst = false;
    s.holdT = 0;
    s.tx = s.x;
    s.ty = s.y;
  }
  state.pucks = [newPuck(0, 0)];
  if (state.setup.insane) {
    const r = state.rng;
    state.pucks.push(newPuck(r.pick([-RINK.circleX, RINK.circleX]), r.pick([-RINK.blueY - 3, RINK.blueY + 3])));
  }
  state.phase = "faceoff";
  state.phaseT = 0;
  state.controlled = state.skaters.findIndex((s) => s.team === 0 && !s.goalie);
  state.events.push({ kind: "faceoff" });
}

export const teammates = (state: MatchState, s: Skater) => state.skaters.filter((o) => o.team === s.team && o !== s);
export const opponents = (state: MatchState, s: Skater) => state.skaters.filter((o) => o.team !== s.team);
export const ownedBy = (state: MatchState, s: Skater) => state.pucks.find((p) => p.owner === s.i);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Distance from point to segment. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2));
  return Math.hypot(px - ax - ex * t, py - ay - ey * t);
}

function release(state: MatchState, s: Skater, p: Puck) {
  p.owner = -1;
  p.last = s.i;
  p.z = 0.05;
  s.pickupCd = 0.28;
  s.charge = -1;
  s.holdT = 0;
}

/**
 * Shoots toward (dirX, dirY). If that points roughly at the net, aim assist picks the spot on the goal line
 * the swipe was heading for. Power 0..1.
 */
export function shoot(state: MatchState, s: Skater, dirX: number, dirY: number, power: number, slap: boolean, aimSpread = 1) {
  const p = ownedBy(state, s);
  if (!p) return;
  const gy = goalYOf(s.team);
  const toNetX = -p.x;
  const toNetY = gy - p.y;
  const len = Math.hypot(dirX, dirY) || 1;
  let ux = dirX / len;
  let uy = dirY / len;
  const nl = Math.hypot(toNetX, toNetY) || 1;
  const cos = (ux * toNetX + uy * toNetY) / nl;
  const inFront = (gy - p.y) * dirOf(s.team) > 0.5;
  if (cos > 0.72 && inFront) {
    // Where would the swipe cross the goal line? Keep it inside the posts.
    const tt = (gy - p.y) / (uy || 1e-6);
    const cross = p.x + ux * tt;
    const lim = RINK.mouth - 0.38;
    const ax = Math.max(-lim, Math.min(lim, cross));
    const l = Math.hypot(ax - p.x, gy - p.y) || 1;
    ux = (ax - p.x) / l;
    uy = (gy - p.y) / l;
  }
  const fire = state.onFire.includes(s.i);
  const oneTimer = !slap && s.recvT < 0.4;
  const err = state.rng.gauss() * (0.022 + (1 - s.info.shot) * 0.05) * (slap ? 1.35 : 1) * (oneTimer ? 0.8 : 1) * (fire ? 0.6 : 1) * aimSpread;
  const a = Math.atan2(uy, ux) + err;
  const speed = (24 + 24 * power) * (0.85 + 0.3 * s.info.shot) * (fire ? 1.28 : 1) * (oneTimer ? 1.18 : 1) + (slap ? 7 : 0);
  release(state, s, p);
  p.vx = Math.cos(a) * speed + s.vx * 0.3;
  p.vy = Math.sin(a) * speed + s.vy * 0.3;
  p.vz = 2 + power * 4;
  p.shotBy = s.i;
  p.passTo = -1;
  p.oneTimer = oneTimer;
  s.face = a;
  s.recvT = 9;
  state.events.push({ kind: "shot", x: p.x, y: p.y, by: s.i, power, oneTimer, slap });
}

/** Passes to `to`, leading the receiver. Lifts it over a stick in the lane (saucer). */
export function pass(state: MatchState, s: Skater, to: Skater) {
  const p = ownedBy(state, s);
  if (!p) return;
  const d0 = dist(p.x, p.y, to.x, to.y);
  const speed = Math.min(20 + 10 * s.info.pass, 12 + d0 * 1.5);
  const lead = (d0 / speed) * 0.85;
  const tx = to.x + to.vx * lead;
  const ty = to.y + to.vy * lead;
  const err = state.rng.gauss() * (0.012 + (1 - s.info.pass) * 0.045);
  const a = Math.atan2(ty - p.y, tx - p.x) + err;
  const saucer = opponents(state, s).some((o) => !o.goalie && segDist(o.x, o.y, p.x, p.y, tx, ty) < 1.5 && dist(o.x, o.y, p.x, p.y) > 1.2);
  release(state, s, p);
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.vz = saucer ? Math.min(9, 3 + d0 * 0.35) : 0;
  p.passTo = to.i;
  p.shotBy = -1;
  s.face = a;
  state.events.push({ kind: "pass", by: s.i, to: to.i, saucer });
}

/** Best pass target: closest to `dirX/dirY` if given, else the most open teammate up ice. */
export function passTarget(state: MatchState, s: Skater, dirX = 0, dirY = 0): Skater | null {
  const mates = teammates(state, s).filter((m) => !m.goalie && m.stun <= 0);
  if (!mates.length) return null;
  const opps = opponents(state, s).filter((o) => !o.goalie);
  const d = dirOf(s.team);
  const steer = Math.hypot(dirX, dirY) > 0.3;
  let best: Skater | null = null;
  let bestScore = -Infinity;
  for (const m of mates) {
    const dx = m.x - s.x;
    const dy = m.y - s.y;
    const l = Math.hypot(dx, dy) || 1;
    const open = Math.min(...opps.map((o) => segDist(o.x, o.y, s.x, s.y, m.x, m.y)), 6);
    let score = open * 0.6 + dy * d * 0.12 - l * 0.04;
    if (steer) score += ((dx * dirX + dy * dirY) / (l * Math.hypot(dirX, dirY))) * 6;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function bodyCheck(state: MatchState, s: Skater, dirX: number, dirY: number) {
  if (s.dash > -0.55 || s.stun > 0 || s.goalie) return;
  const l = Math.hypot(dirX, dirY) || 1;
  s.dash = 0.3;
  s.dashX = dirX / l;
  s.dashY = dirY / l;
  s.face = Math.atan2(s.dashY, s.dashX);
}

export function pokeCheck(state: MatchState, s: Skater) {
  if (s.poke > -0.45 || s.stun > 0 || s.goalie) return;
  s.poke = 0.22;
  const target = state.pucks
    .filter((p) => p.owner >= 0 && state.skaters[p.owner].team !== s.team)
    .sort((a, b) => dist(a.x, a.y, s.x, s.y) - dist(b.x, b.y, s.x, s.y))[0];
  const aim = target ?? state.pucks.slice().sort((a, b) => dist(a.x, a.y, s.x, s.y) - dist(b.x, b.y, s.x, s.y))[0];
  if (aim) s.face = Math.atan2(aim.y - s.y, aim.x - s.x);
  let won = false;
  if (target && dist(stickX(s), stickY(s), target.x, target.y) < 1.7) {
    const c = state.skaters[target.owner];
    if (!c.goalie && state.rng.chance(0.5 + 0.3 * (s.info.hit + s.info.skate) / 2 - 0.25 * c.info.skate)) {
      won = true;
      release(state, c, target);
      target.vx = Math.cos(s.face) * 7 + state.rng.gauss() * 2;
      target.vy = Math.sin(s.face) * 7 + state.rng.gauss() * 2;
      target.last = s.i;
      c.pickupCd = 0.45;
    }
  }
  state.events.push({ kind: "poke", x: stickX(s), y: stickY(s), by: s.i, won });
}

/** Knocks the puck off a skater (after a hit). */
export function dropPuck(state: MatchState, s: Skater) {
  const p = ownedBy(state, s);
  if (!p) return;
  release(state, s, p);
  p.vx = s.vx * 0.6 + state.rng.gauss() * 4;
  p.vy = s.vy * 0.6 + state.rng.gauss() * 4;
  s.pickupCd = 0.6;
}

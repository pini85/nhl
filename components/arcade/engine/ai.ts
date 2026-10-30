import { bodyCheck, dirOf, dist, goalYOf, opponents, ownedBy, pass, passTarget, pokeCheck, segDist, shoot, teammates } from "@/components/arcade/engine/core";
import { RINK } from "@/components/arcade/engine/rink";
import type { MatchState, Puck, Skater } from "@/components/arcade/engine/types";

const levelOf = (state: MatchState, s: Skater) => (s.team === 0 ? state.setup.home.level : state.setup.away.level);

function setTarget(s: Skater, x: number, y: number, speedMul = 1) {
  s.tx = Math.max(-RINK.hw + 1.2, Math.min(RINK.hw - 1.2, x));
  s.ty = Math.max(-RINK.hl + 1.5, Math.min(RINK.hl - 1.5, y));
  s.speedMul = speedMul;
}

/** One AI decision for a skater (not the goalie, not the human's player). */
export function think(state: MatchState, s: Skater) {
  const r = state.rng;
  const L = levelOf(state, s);
  s.think = 0.1 + (1 - L) * 0.2 + r.next() * 0.06;
  s.burst = false;
  if (s.stun > 0) return;

  const d = dirOf(s.team);
  const gy = goalYOf(s.team);
  const ownGy = -gy;
  const mine = ownedBy(state, s);
  const opps = opponents(state, s).filter((o) => !o.goalie);
  const mates = teammates(state, s).filter((m) => !m.goalie);
  const ownedByTeam = (team: 0 | 1) => state.pucks.filter((p) => p.owner >= 0 && state.skaters[p.owner].team === team);

  if (mine) return carry(state, s, mine, L);

  const ourPucks = ownedByTeam(s.team);
  const theirPucks = ownedByTeam(s.team === 0 ? 1 : 0);
  const loose = state.pucks.filter((p) => p.owner < 0);

  // Defend: one presses the nearest carrier, the rest take the slot and the open man.
  if (theirPucks.length && !ourPucks.length) {
    const p = theirPucks.sort((a, b) => dist(a.x, a.y, 0, ownGy) - dist(b.x, b.y, 0, ownGy))[0];
    const carrier = state.skaters[p.owner];
    const squad = [s, ...mates].filter((m) => m.stun <= 0 && !(m.team === 0 && m.i === state.controlled && !state.setup.humanless && state.idle <= 0.6));
    squad.sort((a, b) => dist(a.x, a.y, carrier.x, carrier.y) - dist(b.x, b.y, carrier.x, carrier.y));
    const rank = squad.indexOf(s);
    if (rank === 0 || (rank === -1 && dist(s.x, s.y, carrier.x, carrier.y) < 4)) {
      const lead = 0.25 + 0.15 * L;
      setTarget(s, carrier.x + carrier.vx * lead, carrier.y + carrier.vy * lead, 1);
      const near = dist(s.x, s.y, carrier.x, carrier.y);
      s.burst = near > 4 && s.stamina > 0.45;
      if (near < 2.8 && !carrier.goalie && r.chance(0.07 + 0.16 * L)) {
        if (s.info.hit > 0.45 && r.chance(0.2 + s.info.hit * 0.35) && near > 1.4) bodyCheck(state, s, carrier.x - s.x, carrier.y - s.y);
        else pokeCheck(state, s);
      }
      return;
    }
    if (rank === 1) {
      // Between the puck and our net, closer to the net.
      setTarget(s, p.x * 0.45, ownGy + (p.y - ownGy) * 0.4);
      return;
    }
    // Mark the other attacker that is most dangerous.
    const other = opps.filter((o) => o !== carrier).sort((a, b) => dist(a.x, a.y, 0, ownGy) - dist(b.x, b.y, 0, ownGy))[0];
    if (other) setTarget(s, other.x * 0.85, other.y - d * 1.8);
    else setTarget(s, 0, ownGy + d * 9);
    return;
  }

  // Loose puck: the nearest two go for it (the second a little wider), the last one stays back.
  if (!ourPucks.length && loose.length) {
    const p = loose.sort((a, b) => dist(a.x, a.y, s.x, s.y) - dist(b.x, b.y, s.x, s.y))[0];
    const squad = [s, ...mates].filter((m) => m.stun <= 0).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    const rank = squad.indexOf(s);
    const ahead = 0.18 + 0.12 * L;
    if (rank === 0) {
      setTarget(s, p.x + p.vx * ahead, p.y + p.vy * ahead, 1);
      s.burst = s.stamina > 0.5 && dist(s.x, s.y, p.x, p.y) > 3;
    } else if (rank === 1) setTarget(s, p.x * 0.6 + (s.x > 0 ? 3 : -3), p.y - d * 4);
    else setTarget(s, p.x * 0.3, Math.min(p.y * d - 10, RINK.blueY) * d);
    return;
  }

  // We have it: support the carrier. One drives to the slot, one stays high as an outlet.
  const p = ourPucks[0];
  if (!p) {
    setTarget(s, 0, ownGy + d * 10);
    return;
  }
  const carrier = state.skaters[p.owner];
  const support = mates.filter((m) => m !== carrier).concat(s).sort((a, b) => a.i - b.i);
  const k = support.indexOf(s);
  const side = carrier.x > 0 ? -1 : 1;
  const deep = (carrier.y - 0) * d; // how far up ice the carrier is
  if (deep < 2) {
    // Breakout: get open up the wings.
    setTarget(s, side * (k === 0 ? 8 : -2) + r.gauss() * 0.8, carrier.y + d * (k === 0 ? 9 : 3), 1);
  } else if (k === 0) {
    setTarget(s, side * 3.5 + r.gauss() * 0.7, gy - d * (6 + r.next() * 2), 1);
  } else {
    setTarget(s, -side * 6 + r.gauss(), gy - d * 13, 0.9);
  }
}

function carry(state: MatchState, s: Skater, p: Puck, L: number) {
  const r = state.rng;
  const d = dirOf(s.team);
  const gy = goalYOf(s.team);
  const opps = opponents(state, s).filter((o) => !o.goalie);
  const goalie = opponents(state, s).find((o) => o.goalie);
  const toGoal = dist(p.x, p.y, 0, gy);
  const inFront = (gy - p.y) * d > 1.8;
  const pressure = Math.min(...opps.map((o) => dist(o.x, o.y, s.x, s.y)), 99);
  const blockers = opps.filter((o) => segDist(o.x, o.y, p.x, p.y, 0, gy) < 1.3).length;

  if (inFront && toGoal < 17 && Math.abs(p.x) < 11) {
    let want = 0.12 + 0.55 * (1 - toGoal / 17) + (pressure < 2.5 ? 0.25 : 0) - blockers * 0.18 + (s.recvT < 0.35 ? 0.4 : 0);
    if (state.onFire.includes(s.i)) want += 0.25;
    if (r.chance(want)) {
      // Aim for the side the goalie is not covering.
      const gx = goalie?.x ?? 0;
      const side = Math.abs(gx) < 0.25 ? r.pick([-1, 1]) : gx > 0 ? -1 : 1;
      const ax = side * (RINK.mouth - 0.45);
      const slap = toGoal > 11 && pressure > 4 && r.chance(0.45);
      shoot(state, s, ax - p.x, gy - p.y, slap ? 1 : 0.55 + 0.45 * r.next(), slap, 1 + (1 - L) * 0.9);
      return;
    }
  }

  const mate = passTarget(state, s);
  const mateOpen = mate && Math.min(...opps.map((o) => segDist(o.x, o.y, s.x, s.y, mate.x, mate.y)), 9) > 1.8;
  const mateBetter = mate && dist(mate.x, mate.y, 0, gy) < toGoal - 4 && mateOpen;
  if (mate && mateOpen && ((pressure < 2.3 && r.chance(0.45 + 0.35 * s.info.pass)) || (mateBetter && r.chance(0.25 + 0.3 * L)))) {
    pass(state, s, mate);
    return;
  }

  // Skate toward the net, around whoever is in the way.
  const side = Math.abs(s.x) > 2 ? Math.sign(s.x) : r.pick([-1, 1]);
  let tx = side * 4;
  let ty = gy - d * 6.5;
  if (!inFront || (gy - s.y) * d < 6) {
    tx = side * 6;
    ty = gy - d * 9;
  }
  for (const o of opps) {
    const dd = dist(o.x, o.y, s.x, s.y);
    if (dd < 4.5 && (o.y - s.y) * d > -1) {
      tx += ((s.x - o.x) / dd) * 5;
      ty += ((s.y - o.y) / dd) * 1.5;
    }
  }
  setTarget(s, tx, ty, 1);
  s.burst = pressure > 3 && s.stamina > 0.35 && r.chance(0.5 + 0.3 * L);
}

/** Goalies: hug an arc in front of the net, read shots and slide across; clear the puck after a freeze. */
export function goalieThink(state: MatchState, g: Skater, dt: number) {
  const s = -dirOf(g.team); // the goal this goalie guards is at y = s * goalY
  const gy = s * RINK.goalY;
  const mine = ownedBy(state, g);
  if (mine) {
    g.holdT += dt;
    g.tx = 0;
    g.ty = gy - s * 1.4;
    if (g.holdT > 0.75) {
      const to = passTarget(state, g);
      if (to) pass(state, g, to);
    }
    return;
  }
  // Watch the most dangerous puck.
  const p = state.pucks.slice().sort((a, b) => dist(a.x, a.y, 0, gy) - dist(b.x, b.y, 0, gy))[0];
  if (!p) return;
  const coming = p.owner < 0 && p.vy * s > 6 && p.shotBy >= 0;
  // A shot: after a reaction delay, slide toward where it will cross the goal line.
  if (!coming) g.think = 0;
  else g.think += dt;
  const reaction = 0.17 - 0.1 * g.info.save;
  if (coming && g.think < reaction) return;
  if (coming) {
    const tt = (gy - p.y) / p.vy;
    const xc = p.x + p.vx * tt;
    g.tx = Math.max(-RINK.mouth - 0.3, Math.min(RINK.mouth + 0.3, xc * 0.9));
    g.ty = gy - s * 1.1;
    return;
  }
  const ang = Math.atan2(p.x, (p.y - gy) * -s);
  const a = Math.max(-1.25, Math.min(1.25, ang));
  const far = dist(p.x, p.y, 0, gy);
  const out = far < 6 ? 1.0 : 1.6;
  g.tx = Math.sin(a) * out;
  g.ty = gy - s * Math.cos(a) * out;
}

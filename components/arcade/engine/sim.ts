import { goalieThink, think } from "@/components/arcade/engine/ai";
import {
  accelOf,
  bodyCheck,
  dirOf,
  dist,
  dropPuck,
  faceoff,
  maxSpeed,
  ownedBy,
  pass,
  passTarget,
  pokeCheck,
  PUCK_R,
  REACH,
  shoot,
  stickX,
  stickY,
} from "@/components/arcade/engine/core";
import { boards, bumpCircle, crossedGoal, nets, RINK } from "@/components/arcade/engine/rink";
import type { Input, MatchState, Puck, Skater } from "@/components/arcade/engine/types";

export const STEP = 1 / 120;
const GOAL_PAUSE = 3.4;
const FACEOFF_PAUSE = 1.3;

/** Advance the match by one fixed step. Events for effects and sound are appended to state.events. */
export function step(state: MatchState, input: Input, dt = STEP) {
  state.t += dt;
  state.phaseT += dt;
  if (state.switchLock > 0) state.switchLock -= dt;

  if (state.phase === "end") return;
  if (state.phase === "goal") {
    state.timeScale = state.phaseT < 1.3 ? 0.3 : 1;
    if (state.phaseT > GOAL_PAUSE) {
      state.timeScale = 1;
      if (state.ot) return finish(state);
      faceoff(state, state.lastGoal!.team === 0 ? 1 : 0);
    }
  }
  if (state.phase === "faceoff") {
    if (state.phaseT > FACEOFF_PAUSE) {
      state.phase = "play";
      state.phaseT = 0;
      for (const p of state.pucks) {
        p.vx = state.rng.gauss() * 1.2;
        p.vy = state.rng.gauss() * 1.2;
        p.vz = 3;
      }
      state.events.push({ kind: "drop" });
    } else return;
  }

  if (state.phase === "play") {
    if (state.ot) state.clock += dt;
    else {
      state.clock -= dt;
      if (state.clock <= 0) {
        state.clock = 0;
        if (state.score[0] === state.score[1]) {
          state.ot = true;
          state.events.push({ kind: "overtime" });
          faceoff(state, state.rng.chance(0.5) ? 0 : 1);
          return;
        }
        return finish(state);
      }
    }
  }

  let human = state.setup.humanless ? null : state.skaters[state.controlled];
  if (human && state.phase === "play") applyHuman(state, human, input, dt);
  // Autopilot: a thumb off the stick hands the player to the AI, except while carrying the puck.
  state.idle = Math.hypot(input.mx, input.my) > 0.1 || input.actions.length ? 0 : state.idle + dt;
  if (human && state.idle > 0.6 && !ownedBy(state, human) && human.charge < 0) human = null;

  for (const s of state.skaters) {
    if (s.goalie) goalieThink(state, s, dt);
    else if (s !== human) {
      s.think -= dt;
      if (s.think <= 0 && state.phase === "play") think(state, s);
    }
    if (s.charge >= 0) s.charge = Math.min(1, s.charge + dt / 0.75);
    if (s.charge >= 0 && !ownedBy(state, s)) s.charge = -1;
  }

  moveSkaters(state, human, input, dt);
  collideSkaters(state);
  for (const p of state.pucks) movePuck(state, p, dt);
  if (state.phase === "play") {
    pickups(state);
    steals(state, dt);
    autoSwitch(state);
  }
}

function finish(state: MatchState) {
  state.phase = "end";
  state.phaseT = 0;
  state.events.push({ kind: "end", winner: state.score[0] > state.score[1] ? 0 : 1 });
}

function applyHuman(state: MatchState, s: Skater, input: Input, dt: number) {
  const has = ownedBy(state, s);
  s.burst = input.burst && s.stamina > 0.05;
  for (const a of input.actions) {
    if (a.kind === "tap") {
      if (has) {
        const to = passTarget(state, s, input.mx, input.my);
        if (to) pass(state, s, to);
      } else manualSwitch(state);
    } else if (a.kind === "swipe") {
      if (ownedBy(state, s)) shoot(state, s, a.dx, a.dy, a.power, false);
      else bodyCheck(state, s, a.dx, a.dy);
    } else if (a.kind === "charge") {
      if (ownedBy(state, s)) s.charge = 0;
    } else if (a.kind === "release") {
      if (s.charge >= 0 && ownedBy(state, s)) {
        const gy = dirOf(s.team) * RINK.goalY;
        const side = Math.abs(input.mx) > 0.25 ? Math.sign(input.mx) : -Math.sign(s.x || 1);
        const aimX = side * (RINK.mouth - 0.45);
        const power = Math.max(0.35, s.charge);
        shoot(state, s, aimX - s.x, gy - s.y, power, s.charge > 0.4);
      } else if (!ownedBy(state, s)) pokeCheck(state, s);
      s.charge = -1;
    }
  }
  void dt;
}

function manualSwitch(state: MatchState) {
  const target = hotPuck(state);
  if (!target) return;
  const cands = state.skaters.filter((s) => s.team === 0 && !s.goalie && s.i !== state.controlled);
  cands.sort((a, b) => dist(a.x, a.y, target.x, target.y) - dist(b.x, b.y, target.x, target.y));
  if (cands[0]) {
    state.controlled = cands[0].i;
    state.switchLock = 1;
    state.events.push({ kind: "switch", to: cands[0].i });
  }
}

/** The puck the human team should care about most: theirs/loose, nearest our net. */
function hotPuck(state: MatchState): Puck | undefined {
  return state.pucks.slice().sort((a, b) => a.y - b.y)[0];
}

function autoSwitch(state: MatchState) {
  if (state.setup.humanless) return;
  const owned = state.pucks.find((p) => p.owner >= 0 && state.skaters[p.owner].team === 0 && !state.skaters[p.owner].goalie);
  if (owned) {
    if (owned.owner !== state.controlled) {
      state.controlled = owned.owner;
      state.events.push({ kind: "switch", to: owned.owner });
    }
    return;
  }
  if (state.switchLock > 0) return;
  const p = hotPuck(state);
  if (!p) return;
  // A pass on its way to a teammate: switch to the receiver.
  if (p.passTo >= 0 && state.skaters[p.passTo].team === 0 && p.passTo !== state.controlled) {
    state.controlled = p.passTo;
    state.switchLock = 0.4;
    return;
  }
  const cur = state.skaters[state.controlled];
  const best = state.skaters
    .filter((s) => s.team === 0 && !s.goalie && s.stun <= 0)
    .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
  if (best && best !== cur && dist(cur.x, cur.y, p.x, p.y) - dist(best.x, best.y, p.x, p.y) > 4) {
    state.controlled = best.i;
    state.switchLock = 0.6;
    state.events.push({ kind: "switch", to: best.i });
  }
}

function moveSkaters(state: MatchState, human: Skater | null, input: Input, dt: number) {
  const frozen = state.phase !== "play";
  for (const s of state.skaters) {
    if (s.stun > 0) s.stun -= dt;
    if (s.dash > -0.6) s.dash -= dt;
    if (s.poke > -0.5) s.poke -= dt;
    if (s.pickupCd > 0) s.pickupCd -= dt;
    s.recvT += dt;
    const bursting = s.burst && (Math.hypot(s.vx, s.vy) > 3 || s === human);
    s.stamina = Math.max(0, Math.min(1, s.stamina + (bursting ? -0.4 : 0.18) * dt));
    if (s.stamina <= 0.01) s.burst = false;

    let dvx = 0;
    let dvy = 0;
    const max = maxSpeed(state, s);
    if (s.stun > 0 || (frozen && state.phase !== "goal")) {
      dvx = 0;
      dvy = 0;
    } else if (s.dash > 0) {
      const v = 15 + 4 * s.info.skate;
      dvx = s.dashX * v;
      dvy = s.dashY * v;
    } else if (s === human && state.phase === "play") {
      dvx = input.mx * max;
      dvy = input.my * max;
    } else {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy);
      const v = Math.min(max * s.speedMul, d * 3.2);
      if (d > 0.05) {
        dvx = (dx / d) * v;
        dvy = (dy / d) * v;
      }
    }
    const a = s.stun > 0 ? 9 : s.dash > 0 ? 90 : accelOf(s);
    const ex = dvx - s.vx;
    const ey = dvy - s.vy;
    const el = Math.hypot(ex, ey);
    const k = Math.min(1, (a * dt) / (el || 1));
    s.vx += ex * k;
    s.vy += ey * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    boards(s, s.r, 0.25);
    nets(s, s.r, 0.2);
    if (s.goalie) keepInCrease(s);

    // Face where we skate; carriers and goalies keep facing the action.
    const sp = Math.hypot(s.vx, s.vy);
    if (s.goalie) s.face = turn(s.face, s.team === 0 ? Math.PI / 2 : -Math.PI / 2, 10 * dt);
    else if (s.dash <= 0 && s.poke <= 0 && sp > 1.2 && s.charge < 0) s.face = turn(s.face, Math.atan2(s.vy, s.vx), 9 * dt);
    else if (s.charge >= 0) s.face = turn(s.face, Math.atan2(dirOf(s.team) * RINK.goalY - s.y, -s.x), 8 * dt);
  }
}

function keepInCrease(g: Skater) {
  const s = -dirOf(g.team);
  const gy = s * RINK.goalY;
  const dx = g.x;
  const dy = g.y - gy;
  const d = Math.hypot(dx, dy);
  const max = 4.2;
  if (d > max) {
    g.x = (dx / d) * max;
    g.y = gy + (dy / d) * max;
  }
  // Never behind the goal line.
  if ((g.y - gy) * -s < 0.6) g.y = gy - s * 0.6;
}

function turn(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

function collideSkaters(state: MatchState) {
  const list = state.skaters;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d >= min || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const ma = a.goalie ? 5 : 1;
      const mb = b.goalie ? 5 : 1;
      const push = (min - d) / (ma + mb);
      a.x -= nx * push * mb;
      a.y -= ny * push * mb;
      b.x += nx * push * ma;
      b.y += ny * push * ma;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; // closing speed
      if (rel <= 0) continue;
      // Body check?
      const hitter = a.dash > 0 && a.team !== b.team && !b.goalie ? a : b.dash > 0 && a.team !== b.team && !a.goalie ? b : null;
      if (hitter && state.phase === "play") {
        const victim = hitter === a ? b : a;
        const sgn = hitter === a ? 1 : -1;
        const power = rel * (0.7 + 0.6 * hitter.info.hit) * (1.15 - 0.4 * victim.info.hit) * (state.setup.insane ? 1.8 : 1);
        victim.stun = Math.min(1.7, 0.45 + power * 0.05);
        victim.vx += nx * sgn * power * 0.8;
        victim.vy += ny * sgn * power * 0.8;
        hitter.vx *= 0.35;
        hitter.vy *= 0.35;
        hitter.dash = 0;
        hitter.hits++;
        dropPuck(state, victim);
        state.freeze = Math.max(state.freeze, 0.04 + Math.min(0.09, power * 0.004));
        state.events.push({ kind: "hit", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, by: hitter.i, victim: victim.i, power });
        continue;
      }
      const imp = (rel * 0.8) / (ma + mb);
      a.vx -= nx * imp * mb;
      a.vy -= ny * imp * mb;
      b.vx += nx * imp * ma;
      b.vy += ny * imp * ma;
    }
  }
}

function movePuck(state: MatchState, p: Puck, dt: number) {
  const x0 = p.x;
  const y0 = p.y;
  if (p.owner >= 0) {
    const o = state.skaters[p.owner];
    const wob = Math.sin(state.t * 9 + o.i) * 0.12;
    p.x = o.x + Math.cos(o.face + wob) * (o.r + REACH * (o.goalie ? 0.5 : 1));
    p.y = o.y + Math.sin(o.face + wob) * (o.r + REACH * (o.goalie ? 0.5 : 1));
    p.vx = o.vx;
    p.vy = o.vy;
    p.z = 0;
    p.vz = 0;
    boards(p, PUCK_R, 0);
  } else {
    // Air time, then ice friction.
    if (p.z > 0 || p.vz > 0) {
      p.vz -= 32 * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = p.vz < -3 ? -p.vz * 0.3 : 0;
      }
    }
    const fr = Math.exp(-(p.z > 0 ? 0.05 : 0.32) * dt);
    p.vx *= fr;
    p.vy *= fr;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const wall = boards(p, PUCK_R, 0.72);
    if (wall > 9) state.events.push({ kind: "boards", x: p.x, y: p.y, power: wall });
    const n = nets(p, PUCK_R, 0.8);
    if (n.post && n.impact > 6) state.events.push({ kind: "post", x: p.x, y: p.y });
    for (const g of state.skaters) {
      if (!g.goalie || state.phase !== "play") continue;
      const sp = Math.hypot(p.vx, p.vy);
      const hit = bumpCircle(p, PUCK_R, g.x, g.y, g.r, 0.42);
      if (hit <= 0) continue;
      const shooter = p.shotBy >= 0 ? state.skaters[p.shotBy] : null;
      const isShot = shooter && shooter.team !== g.team;
      if (isShot) {
        state.sog[shooter.team]++;
        shooter.shots++;
        g.saves++;
      }
      const hold = sp < 30 && state.rng.chance(0.25 + 0.45 * g.info.save - sp / 120);
      if (hold || sp < 6) {
        p.owner = g.i;
        p.last = g.i;
        p.shotBy = -1;
        p.passTo = -1;
        p.chain = [];
        g.holdT = 0;
      } else {
        // Rebound off the pads, somewhere unpredictable.
        const a = Math.atan2(p.vy, p.vx) + state.rng.gauss() * 0.5;
        const v = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.shotBy = -1;
        p.last = g.i;
      }
      if (isShot) state.events.push({ kind: "save", x: p.x, y: p.y, by: g.i, held: p.owner === g.i });
    }
    if (Math.hypot(p.vx, p.vy) < 12) {
      p.shotBy = -1;
      if (Math.hypot(p.vx, p.vy) < 3) p.passTo = -1;
    }
  }
  p.trail.push({ x: p.x, y: p.y, z: p.z });
  if (p.trail.length > 14) p.trail.shift();

  if (state.phase !== "play") return;
  for (const side of [1, -1] as const) {
    if (crossedGoal(x0, y0, p.x, p.y, side, PUCK_R)) return goal(state, p, side === 1 ? 0 : 1);
  }
}

function goal(state: MatchState, p: Puck, team: 0 | 1) {
  const sk = state.skaters;
  let scorer = p.shotBy >= 0 ? p.shotBy : p.owner >= 0 ? p.owner : p.last;
  if (scorer >= 0 && sk[scorer].team !== team) scorer = [...p.chain].reverse().find((i) => sk[i].team === team) ?? -1;
  if (scorer >= 0 && sk[scorer].goalie) scorer = -1;
  const assists: number[] = [];
  for (const i of [...p.chain].reverse()) {
    if (i === scorer || assists.includes(i) || sk[i].team !== team || sk[i].goalie) continue;
    if (assists.length < 2) assists.push(i);
  }
  state.score[team]++;
  if (p.shotBy >= 0 || p.owner >= 0) state.sog[team]++;
  const fire = scorer >= 0 && state.onFire.includes(scorer);
  if (scorer >= 0) {
    sk[scorer].goals++;
    sk[scorer].shots++;
  }
  for (const a of assists) sk[a].assists++;

  // Two in a row by the same player → ON FIRE, until the other team scores.
  const other = team === 0 ? 1 : 0;
  state.fireRun[other] = { who: -1, n: 0 };
  state.onFire = state.onFire.filter((i) => sk[i].team === team);
  const run = state.fireRun[team];
  if (scorer >= 0 && run.who === scorer) run.n++;
  else state.fireRun[team] = { who: scorer, n: scorer >= 0 ? 1 : 0 };
  if (scorer >= 0 && state.fireRun[team].n >= 2 && !state.onFire.includes(scorer)) {
    state.onFire.push(scorer);
    state.events.push({ kind: "fire", who: scorer });
  }

  state.phase = "goal";
  state.phaseT = 0;
  state.lastGoal = { team, scorer, x: p.x, y: p.y };
  state.freeze = 0.12;
  p.vx *= 0.15;
  p.vy *= 0.15;
  if (p.owner >= 0) {
    p.owner = -1;
  }
  state.events.push({
    kind: "goal",
    team,
    scorer,
    assists,
    x: p.x,
    y: p.y,
    oneTimer: p.oneTimer && p.shotBy >= 0,
    hatTrick: scorer >= 0 && sk[scorer].goals === 3,
    fire,
  });
}

function pickups(state: MatchState) {
  for (const p of state.pucks) {
    if (p.owner >= 0 || p.z > 0.55) continue;
    const speed = Math.hypot(p.vx, p.vy);
    let best: Skater | null = null;
    let bestD = Infinity;
    for (const s of state.skaters) {
      if (s.goalie || s.stun > 0 || s.pickupCd > 0 || state.pucks.some((q) => q.owner === s.i)) continue;
      const reach = p.passTo === s.i ? 1.45 : s.poke > 0 ? 1.4 : 0.95;
      const d = Math.min(dist(stickX(s), stickY(s), p.x, p.y), dist(s.x, s.y, p.x, p.y) - s.r + 0.35);
      if (d < reach && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (!best) continue;
    const shooter = p.shotBy >= 0 ? state.skaters[p.shotBy] : null;
    if (shooter && speed > 19) {
      if (shooter.team === best.team) continue; // teammates let shots through
      if (state.rng.chance(0.4)) {
        // Shot block: off the shin pads.
        p.vx = -p.vx * 0.25 + state.rng.gauss() * 4;
        p.vy = -p.vy * 0.25 + state.rng.gauss() * 4;
        p.shotBy = -1;
        p.last = best.i;
        best.pickupCd = 0.25;
        state.events.push({ kind: "block", x: p.x, y: p.y, by: best.i });
      } else best.pickupCd = 0.15;
      continue;
    }
    if (speed > 15 && p.passTo !== best.i && state.rng.chance(0.45)) {
      best.pickupCd = 0.12;
      continue;
    }
    const prev = p.last >= 0 ? state.skaters[p.last] : null;
    if (p.passTo === best.i) best.recvT = 0;
    p.owner = best.i;
    p.passTo = -1;
    p.shotBy = -1;
    p.oneTimer = false;
    if (prev && prev.team === best.team) {
      if (p.chain[p.chain.length - 1] !== best.i) p.chain.push(best.i);
    } else p.chain = [best.i];
    if (p.chain.length > 4) p.chain.shift();
    p.last = best.i;
  }
}

function steals(state: MatchState, dt: number) {
  for (const p of state.pucks) {
    if (p.owner < 0) continue;
    const c = state.skaters[p.owner];
    if (c.goalie) continue;
    for (const s of state.skaters) {
      if (s.team === c.team || s.goalie || s.stun > 0 || s.pickupCd > 0) continue;
      if (dist(stickX(s), stickY(s), p.x, p.y) > 0.85) continue;
      const rate = Math.max(0.3, 1.6 * (0.6 + 0.5 * s.info.skate + 0.3 * s.info.hit - 0.6 * c.info.skate));
      if (state.rng.chance(rate * dt)) {
        p.owner = s.i;
        p.last = s.i;
        p.chain = [s.i];
        c.pickupCd = 0.5;
        c.charge = -1;
        state.events.push({ kind: "steal", by: s.i });
        break;
      }
    }
  }
}

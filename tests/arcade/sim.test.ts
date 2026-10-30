import { describe, expect, it } from "vitest";
import { createMatch } from "@/components/arcade/engine/core";
import { boards, crossedGoal, insideRink, RINK } from "@/components/arcade/engine/rink";
import { step, STEP } from "@/components/arcade/engine/sim";
import { type GameEvent, type Input, type MatchState, NO_INPUT } from "@/components/arcade/engine/types";
import { match, team } from "./helpers";

function run(s: MatchState, seconds: number, input: Input = NO_INPUT) {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds / STEP; i++) {
    step(s, i === 0 ? input : { ...input, actions: [] });
    events.push(...s.events);
    s.events.length = 0;
  }
  return events;
}

/** Skip the faceoff, then give the human's player the puck at (x, y) with the away goalie parked at the left post. */
function setUp(x: number, y: number) {
  const s = createMatch({ home: team("Home"), away: team("Away"), seed: 3, insane: false, length: 180 });
  run(s, 1.4);
  const me = s.skaters[s.controlled];
  for (const o of s.skaters) if (!o.goalie && o !== me) Object.assign(o, { x: o.team ? -12 : 12, y: -20, vx: 0, vy: 0, tx: o.team ? -12 : 12, ty: -20, think: 99 });
  const g = s.skaters.find((k) => k.goalie && k.team === 1)!;
  Object.assign(g, { x: -1.6, y: RINK.goalY - 1, info: { ...g.info, save: 0 } });
  Object.assign(me, { x, y, vx: 0, vy: 0, face: Math.PI / 2 });
  s.pucks = [s.pucks[0]];
  Object.assign(s.pucks[0], { owner: me.i, x, y: y + 1.5, vx: 0, vy: 0, z: 0, shotBy: -1, passTo: -1 });
  return s;
}

describe("rink", () => {
  it("boards keep a fast puck inside, corners included", () => {
    for (const [vx, vy] of [[50, 0], [0, -60], [40, 40], [-35, 55]]) {
      const b = { x: 0, y: 0, vx, vy };
      for (let i = 0; i < 600; i++) {
        b.x += b.vx * STEP;
        b.y += b.vy * STEP;
        boards(b, 0.2, 0.7);
        expect(insideRink(b.x, b.y, 0.19)).toBe(true);
      }
    }
  });

  it("only counts a goal from the front, between the posts", () => {
    expect(crossedGoal(0, RINK.goalY - 1, 0.5, RINK.goalY + 0.2, 1, 0.2)).toBe(true);
    expect(crossedGoal(0, RINK.goalY + 1, 0, RINK.goalY - 0.2, 1, 0.2)).toBe(false); // from behind
    expect(crossedGoal(3, RINK.goalY - 1, 3, RINK.goalY + 0.2, 1, 0.2)).toBe(false); // wide
    expect(crossedGoal(0, -RINK.goalY + 1, 0, -RINK.goalY - 0.2, -1, 0.2)).toBe(true);
  });
});

describe("a full AI game", () => {
  it("ends with a winner, keeps every puck on the ice and never produces NaN", () => {
    for (const insane of [false, true]) {
      const s = match({ seed: 11, insane, length: 90 });
      let n = 0;
      let end: GameEvent | undefined;
      while (s.phase !== "end" && n < 120 * 900) {
        step(s, NO_INPUT);
        n++;
        end ??= s.events.find((e) => e.kind === "end");
        s.events.length = 0;
        for (const p of s.pucks) {
          expect(Number.isFinite(p.x + p.y + p.vx + p.vy)).toBe(true);
          expect(insideRink(p.x, p.y, 0.1)).toBe(true);
        }
      }
      expect(s.phase).toBe("end");
      expect(s.score[0]).not.toBe(s.score[1]);
      expect(end).toMatchObject({ kind: "end", winner: s.score[0] > s.score[1] ? 0 : 1 });
    }
  });

  it("is the same game for the same seed", () => {
    const a = match({ seed: 5, length: 60 });
    const b = match({ seed: 5, length: 60 });
    run(a, 70);
    run(b, 70);
    expect(a.score).toEqual(b.score);
    expect(a.pucks[0].x).toBe(b.pucks[0].x);
  });

  it("a much better team usually wins", () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match({ seed, home: team("H", 0.9, 0.95), away: team("A", 0.3, 0.1), length: 120 });
      run(s, 400);
      if (s.score[0] > s.score[1]) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});

describe("the human's player", () => {
  it("scores with a swipe at an open net, gets the goal and starts the celebration", () => {
    const s = setUp(1, RINK.goalY - 8);
    const ev = run(s, 0.8, { mx: 0, my: 0, burst: false, actions: [{ kind: "swipe", dx: 0.3, dy: 1, power: 1 }] });
    expect(ev.find((e) => e.kind === "shot")).toBeTruthy();
    const goal = ev.find((e) => e.kind === "goal");
    expect(goal).toMatchObject({ team: 0, scorer: s.controlled });
    expect(s.score).toEqual([1, 0]);
    expect(s.phase).toBe("goal");
    expect(s.timeScale).toBeLessThan(1);
  });

  it("passes with a tap and the receiver becomes the human's player", () => {
    const s = setUp(0, 0);
    const me = s.controlled;
    const mate = s.skaters.find((k) => k.team === 0 && !k.goalie && k.i !== me)!;
    Object.assign(mate, { x: 6, y: 4, think: 99 });
    const ev = run(s, 1.2, { mx: 1, my: 0.3, burst: false, actions: [{ kind: "tap" }] });
    expect(ev.find((e) => e.kind === "pass")).toMatchObject({ by: me, to: mate.i });
    expect(s.pucks[0].owner).toBe(mate.i);
    expect(s.controlled).toBe(mate.i);
  });

  it("a body check flattens the carrier and knocks the puck loose", () => {
    const s = setUp(0, 0);
    const me = s.skaters[s.controlled];
    const carrier = s.skaters.find((k) => k.team === 1 && !k.goalie)!;
    Object.assign(carrier, { x: 0, y: 3, vx: 0, vy: 0, think: 99, tx: 0, ty: 3 });
    Object.assign(s.pucks[0], { owner: carrier.i, x: 0, y: 2 });
    const ev = run(s, 0.4, { mx: 0, my: 0, burst: false, actions: [{ kind: "swipe", dx: 0, dy: 1, power: 1 }] });
    expect(ev.find((e) => e.kind === "hit")).toMatchObject({ by: me.i, victim: carrier.i });
    expect(carrier.stun).toBeGreaterThan(0);
    expect(s.pucks[0].owner).not.toBe(carrier.i);
  });

  it("two goals in a row by the same player sets them ON FIRE", () => {
    const s = setUp(1, RINK.goalY - 8);
    const scorer = s.controlled;
    run(s, 5, { mx: 0, my: 0, burst: false, actions: [{ kind: "swipe", dx: 0.3, dy: 1, power: 1 }] });
    expect(s.score).toEqual([1, 0]);
    // Second goal by the same player.
    const again = setUp(1, RINK.goalY - 8);
    again.skaters = s.skaters;
    again.fireRun = s.fireRun;
    again.score = s.score;
    Object.assign(again.skaters[scorer], { x: 1, y: RINK.goalY - 8, vx: 0, vy: 0, face: Math.PI / 2 });
    Object.assign(again.pucks[0], { owner: scorer, x: 1, y: RINK.goalY - 6.5 });
    again.controlled = scorer;
    const g = again.skaters.find((k) => k.goalie && k.team === 1)!;
    Object.assign(g, { x: -1.6, y: RINK.goalY - 1, info: { ...g.info, save: 0 } });
    const ev = run(again, 1, { mx: 0, my: 0, burst: false, actions: [{ kind: "swipe", dx: 0.3, dy: 1, power: 1 }] });
    expect(ev.find((e) => e.kind === "fire")).toMatchObject({ who: scorer });
    expect(again.onFire).toContain(scorer);
  });
});

describe("clock", () => {
  it("a tie at the end goes to sudden-death overtime", () => {
    const s = match({ seed: 2, length: 1 });
    s.score = [2, 2];
    const ev = run(s, 2.6);
    expect(ev.find((e) => e.kind === "overtime")).toBeTruthy();
    expect(s.ot).toBe(true);
  });
});

describe("autopilot", () => {
  it("an idle player off the puck is moved by the AI, and stops when the thumb is back", () => {
    const s = createMatch({ home: team("Home"), away: team("Away"), seed: 4, insane: false, length: 180 });
    run(s, 4);
    const me = s.skaters[s.controlled];
    expect(Math.hypot(me.vx, me.vy) + Math.abs(me.tx - me.x) + Math.abs(me.ty - me.y)).toBeGreaterThan(0.5);
    expect(s.idle).toBeGreaterThan(0.6);
    run(s, 0.1, { mx: 1, my: 0, burst: false, actions: [] });
    expect(s.idle).toBe(0);
  });
});

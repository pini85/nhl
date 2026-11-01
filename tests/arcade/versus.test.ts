import { describe, expect, it } from "vitest";
import { createMatch } from "@/components/arcade/engine/core";
import { step, STEP } from "@/components/arcade/engine/sim";
import { type GameEvent, type Input, NO_INPUT } from "@/components/arcade/engine/types";
import { apply, encode, guestInput, guestView, mirrorEvent, readSetup, readTeam, RIVAL, versusSetup } from "@/components/arcade/net/snapshot";
import { RINK } from "@/components/arcade/engine/rink";
import { team } from "./helpers";

const host = team("Host");
const guest = { ...team("Guest"), skaters: team("Guest").skaters.map((p, i) => ({ ...p, you: i === 0 })) };
const setup = versusSetup(host, guest, { seed: 9, insane: false, length: 60 });

function run(s: ReturnType<typeof createMatch>, seconds: number, a: Input = NO_INPUT, b: Input = NO_INPUT) {
  for (let i = 0; i < seconds / STEP; i++) {
    step(s, a, STEP, b);
    s.events.length = 0;
  }
}

describe("versus play", () => {
  it("the away team follows the second thumb", () => {
    const s = createMatch(setup);
    run(s, 1.4); // faceoff
    const me = s.skaters[s.pilots[1].controlled];
    expect(me.team).toBe(1);
    const x0 = me.x;
    run(s, 0.6, NO_INPUT, { mx: 1, my: 0, burst: false, actions: [] });
    expect(me.x - x0).toBeGreaterThan(3);
    expect(s.pilots[1].idle).toBe(0);
  });

  it("a guest's swipe up their screen scores on the host's net", () => {
    const s = createMatch(setup);
    run(s, 1.4);
    const me = s.skaters[s.pilots[1].controlled];
    for (const o of s.skaters) if (!o.goalie && o !== me) Object.assign(o, { x: 12, y: 20, vx: 0, vy: 0, tx: 12, ty: 20, think: 99 });
    const g = s.skaters.find((k) => k.goalie && k.team === 0)!;
    Object.assign(g, { x: 1.6, y: -RINK.goalY + 1, info: { ...g.info, save: 0 } });
    Object.assign(me, { x: -1, y: -RINK.goalY + 8, vx: 0, vy: 0, face: -Math.PI / 2 });
    s.pucks = [s.pucks[0]];
    Object.assign(s.pucks[0], { owner: me.i, x: -1, y: -RINK.goalY + 6.5, vx: 0, vy: 0, z: 0, shotBy: -1, passTo: -1 });
    // On the guest's phone their attack is up the screen, as for the host.
    const swipe = guestInput({ mx: 0, my: 0, actions: [{ kind: "swipe", dx: 0.3, dy: 1, power: 1 }] });
    const events: GameEvent[] = [];
    for (let i = 0; i < 0.8 / STEP; i++) {
      step(s, NO_INPUT, STEP, i === 0 ? swipe : NO_INPUT);
      events.push(...s.events);
      s.events.length = 0;
    }
    expect(events.find((e) => e.kind === "goal")).toMatchObject({ team: 1, scorer: me.i });
    expect(s.score).toEqual([0, 1]);
  });

  it("the clock runs out with two idle humans, and nothing breaks", () => {
    const s = createMatch({ ...setup, length: 30 });
    for (let n = 0; n < 120 * 60 && s.phase !== "end" && !s.ot; n++) {
      step(s, NO_INPUT, STEP, NO_INPUT);
      for (const p of s.pucks) expect(Number.isFinite(p.x + p.y)).toBe(true);
    }
    expect(s.phase === "end" || s.ot).toBe(true);
  });

  it("only the guest's own players are marked as theirs, on either phone", () => {
    expect(setup.away.color).toBe(RIVAL);
    expect(setup.away.skaters.some((p) => p.you)).toBe(false);
    const view = guestView(setup, guest);
    expect(view.home.skaters[0].you).toBe(true);
    expect(view.away.name).toBe("Host");
    expect(view.away.color).toBe(RIVAL);
  });
});

describe("snapshots", () => {
  it("the guest sees the rink turned around with the teams swapped", () => {
    const s = createMatch(setup);
    run(s, 3, { mx: 0.5, my: 1, burst: false, actions: [] });
    s.score = [2, 1];
    s.pucks[0].owner = 5;
    const view = createMatch(guestView(setup, guest));
    apply(view, JSON.parse(JSON.stringify(encode(s, 1))), true);
    for (let i = 0; i < 8; i++) {
      const a = s.skaters[i];
      const b = view.skaters[(i + 4) % 8];
      expect(b.x).toBeCloseTo(-a.x, 2);
      expect(b.y).toBeCloseTo(-a.y, 2);
      expect(b.team).not.toBe(a.team);
    }
    expect(view.score).toEqual([1, 2]);
    expect(view.pucks[0].owner).toBe(1); // the guest's own skater, now at the front of the list
    expect(view.pilots[0].controlled).toBe((s.pilots[1].controlled + 4) % 8);
    // The host's own view is unchanged.
    const same = createMatch(setup);
    apply(same, encode(s, 1), false);
    expect(same.skaters[2].x).toBeCloseTo(s.skaters[2].x, 2);
  });

  it("events are turned around too", () => {
    const goal: GameEvent = { kind: "goal", team: 1, scorer: 5, assists: [6], x: 1, y: -30, oneTimer: false, hatTrick: false, fire: false };
    expect(mirrorEvent(goal, 8)).toMatchObject({ team: 0, scorer: 1, assists: [2], x: -1, y: 30 });
    expect(mirrorEvent({ kind: "end", winner: 1 }, 8)).toEqual({ kind: "end", winner: 0 });
  });

  it("the guest's thumbs are turned back and checked", () => {
    const inp = guestInput({ mx: 0.5, my: 9, burst: 1, actions: [{ kind: "swipe", dx: 3, dy: -4, power: 7 }, { kind: "boom" }, { kind: "tap" }] });
    expect(inp).toEqual({ mx: -0.5, my: -1, burst: true, actions: [{ kind: "swipe", dx: -3, dy: 4, power: 1 }, { kind: "tap" }] });
    expect(guestInput({ actions: "nope" })).toEqual(NO_INPUT);
  });

  it("rejects a malformed team or match", () => {
    expect(readTeam(guest)).toEqual(guest);
    expect(readTeam({ ...guest, skaters: [] })).toBeNull();
    expect(readSetup(setup)).toEqual(setup);
    expect(readSetup({ ...setup, length: 1e9 })).toBeNull();
  });
});

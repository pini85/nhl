import { describe, expect, it } from "vitest";
import { createMatch } from "@/components/arcade/engine/core";
import { step, STEP } from "@/components/arcade/engine/sim";
import { type Input, NO_INPUT } from "@/components/arcade/engine/types";
import { HostLobby, type Start } from "@/components/arcade/net/lobby";
import { allReady, LOBBY_SECONDS, type Member, openSide, partySetup, sideTeam } from "@/components/arcade/net/party";
import type { Link, Msg } from "@/components/arcade/net/peer";
import { apply, encode, guestInput, partyView, readSetup, RIVAL } from "@/components/arcade/net/snapshot";
import { team } from "./helpers";

const member = (id: number, side: 0 | 1, ready = false): Member => ({ id, name: `P${id}`, side, ready, team: team(`T${id}`) });
const ai = team("Ai");
const right: Input = { mx: 1, my: 0, burst: false, actions: [] };

function run(s: ReturnType<typeof createMatch>, seconds: number, inputs: Input[] = []) {
  for (let i = 0; i < seconds / STEP; i++) {
    step(s, inputs);
    s.events.length = 0;
  }
}

describe("party teams", () => {
  it("each human skates as their own first player; the captain fills the rest", () => {
    const t = sideTeam([team("A"), team("B")], ai);
    expect(t.skaters.map((p) => p.id)).toEqual(["A1", "B1", "A2"]);
    expect(t.goalie.id).toBe("AG");
    expect(t.name).toBe("A");
  });

  it("never puts the same player on the ice twice (friends from one club)", () => {
    const t = sideTeam([team("A"), team("A"), team("A")], ai);
    expect(t.skaters.map((p) => p.id)).toEqual(["A1", "A2", "A3"]);
  });

  it("an empty side is the AI club", () => {
    expect(sideTeam([], ai).name).toBe("Ai");
  });

  it("the host's side is home, wherever the host sat", () => {
    const setup = partySetup([member(0, 1), member(1, 0), member(2, 0), member(3, 1)], ai, { seed: 1, insane: false });
    expect(setup.party).toEqual([
      { team: 0, slot: 0 },
      { team: 1, slot: 0 },
      { team: 1, slot: 1 },
      { team: 0, slot: 1 },
    ]);
    expect(setup.home.name).toBe("T0");
    expect(setup.away.name).toBe("T1");
    expect(setup.away.color).toBe(RIVAL);
    expect(readSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup);
  });

  it("fills the emptier side first, three a side at most", () => {
    expect(openSide([member(0, 0)])).toBe(1);
    expect(openSide([member(0, 0), member(1, 1)])).toBe(0);
    expect(openSide([0, 1, 2].map((i) => member(i, 0)))).toBe(1);
    expect(openSide([0, 1, 2, 3, 4, 5].map((i) => member(i, i < 3 ? 0 : 1)))).toBeNull();
    expect(allReady([member(0, 0, true)])).toBe(false);
    expect(allReady([member(0, 0, true), member(1, 1, true)])).toBe(true);
  });
});

describe("party play", () => {
  // Host + friend on the left, one friend on the right.
  const setup = partySetup([member(0, 0), member(1, 0), member(2, 1)], ai, { seed: 3, insane: false, length: 60 });

  it("teammates each keep their own skater; a lone human still switches", () => {
    const s = createMatch(setup);
    expect(s.pilots.map((p) => [p.team, p.fixed, p.controlled])).toEqual([
      [0, true, 0],
      [0, true, 1],
      [1, false, 4],
    ]);
    run(s, 1.4);
    const mine = s.skaters[1];
    const x0 = mine.x;
    run(s, 0.6, [NO_INPUT, right, NO_INPUT]);
    expect(mine.x - x0).toBeGreaterThan(3);
    expect(s.pilots[1].controlled).toBe(1);
    // A tap without the puck doesn't move a fixed pilot to another skater.
    for (const sk of s.skaters) if (sk.team === 0 && sk.i !== 1) Object.assign(sk, { x: 0, y: -5 });
    s.pucks[0].owner = -1;
    run(s, 0.1, [NO_INPUT, { ...NO_INPUT, actions: [{ kind: "tap" }] }, NO_INPUT]);
    expect(s.pilots[1].controlled).toBe(1);
    expect(s.pilots[0].controlled).toBe(0);
  });

  it("a whole game with idle humans runs out cleanly", () => {
    const s = createMatch({ ...setup, length: 20 });
    for (let n = 0; n < 120 * 60 && s.phase !== "end" && !s.ot; n++) {
      step(s, [NO_INPUT, NO_INPUT, NO_INPUT]);
      s.events.length = 0;
    }
    expect(s.phase === "end" || s.ot).toBe(true);
    expect(s.pilots[0].controlled).toBe(0);
    expect(s.pilots[1].controlled).toBe(1);
  });

  it("each phone sees its own skater, turned around only on the away side", () => {
    const s = createMatch(setup);
    run(s, 2, [NO_INPUT, right, NO_INPUT]);
    const snap = JSON.parse(JSON.stringify(encode(s, 1)));
    // The host's teammate: not mirrored, pilot 1.
    const mate = createMatch(partyView(setup, setup.party![1]));
    apply(mate, snap, false, 0, 1);
    expect(mate.pilots[0].controlled).toBe(1);
    expect(mate.skaters[1].x).toBeCloseTo(s.skaters[1].x, 2);
    expect(mate.setup.home.skaters[1].you).toBe(true);
    expect(mate.setup.home.skaters[0].you).toBe(false);
    // The friend on the other side: mirrored, pilot 2.
    const rival = createMatch(partyView(setup, setup.party![2]));
    apply(rival, snap, true, 0, 2);
    expect(rival.pilots[0].controlled).toBe((s.pilots[2].controlled + 4) % 8);
    expect(rival.setup.home.name).toBe("T2");
    expect(rival.setup.away.color).toBe(RIVAL);
  });

  it("a teammate's thumbs are not turned around", () => {
    expect(guestInput({ mx: 0.5, my: -0.5 }, false)).toMatchObject({ mx: 0.5, my: -0.5 });
    expect(guestInput({ mx: 0.5, my: -0.5 })).toMatchObject({ mx: -0.5, my: 0.5 });
  });
});

/** A link with nothing on the other end: we read what was sent and push messages in. */
function fakeLink() {
  const subs = new Set<(m: Msg) => void>();
  const closers = new Set<() => void>();
  const sent: Msg[] = [];
  let open = true;
  const link: Link = {
    send: (m) => void sent.push(m),
    sendFast: () => {},
    on: (f) => (subs.add(f), () => void subs.delete(f)),
    onFast: () => () => {},
    onClose: (f) => (closers.add(f), () => void closers.delete(f)),
    close: () => {
      if (!open) return;
      open = false;
      for (const f of closers) f();
    },
    get open() {
      return open;
    },
  };
  return { link, sent, say: (m: Msg) => subs.forEach((f) => f(m)), last: (t: string) => sent.filter((m) => m.t === t).at(-1) };
}

function lobby() {
  let t = 0;
  const starts: Start[] = [];
  const closes: string[] = [];
  const room = new HostLobby({ name: "Host", team: team("H") }, { change: () => {}, start: (s) => starts.push(s), close: (w) => closes.push(w) }, { ai: () => ai, insane: () => false, now: () => t });
  return { room, starts, closes, wait: (s: number) => (t += s * 1000) };
}

describe("lobby", () => {
  it("seats newcomers, and starts when everyone's ready", () => {
    const { room, starts } = lobby();
    const a = fakeLink();
    const b = fakeLink();
    room.add(a.link);
    room.add(b.link);
    a.say({ t: "hi", name: "Ann", team: team("A") });
    expect(a.last("you")).toEqual({ t: "you", id: 1 });
    expect(room.info().members.map((m) => [m.name, m.side])).toEqual([
      ["Host", 0],
      ["Ann", 1],
      ["Joining…", 0],
    ]);
    b.say({ t: "seat", side: 1 });
    a.say({ t: "ready", on: true });
    b.say({ t: "ready", on: true });
    room.tick();
    expect(starts).toHaveLength(0);
    room.ready(true);
    room.tick();
    expect(starts).toHaveLength(1);
    const { setup, guests } = starts[0];
    expect(setup.party).toEqual([
      { team: 0, slot: 0 },
      { team: 1, slot: 0 },
      { team: 1, slot: 1 },
    ]);
    expect(guests.map((g) => [g.pilot, g.mirror])).toEqual([
      [1, true],
      [2, true],
    ]);
    expect(a.last("start")).toMatchObject({ me: 1 });
    expect(b.last("start")).toMatchObject({ me: 2 });
    expect(room.info().playing).toBe(true);
  });

  it("drops the puck when the clock runs out, with whoever is there", () => {
    const l = lobby();
    l.room.add(fakeLink().link);
    l.wait(LOBBY_SECONDS - 1);
    l.room.tick();
    expect(l.starts).toHaveLength(0);
    l.wait(1);
    l.room.tick();
    expect(l.starts).toHaveLength(1);
    // After the game, a fresh clock and nobody ready.
    l.room.ended();
    expect(l.room.left()).toBe(LOBBY_SECONDS);
    expect(l.room.info().members.every((m) => !m.ready)).toBe(true);
  });

  it("the clock waits for a second phone, and stops if the host is alone again", () => {
    const { room, starts, closes, wait } = lobby();
    expect(room.left()).toBeNull();
    wait(LOBBY_SECONDS * 5);
    room.tick();
    expect(starts).toHaveLength(0);
    expect(closes).toHaveLength(0);
    expect(room.info().left).toBeNull();
    const a = fakeLink();
    room.add(a.link);
    expect(room.left()).toBe(LOBBY_SECONDS);
    wait(30);
    a.link.close();
    expect(room.left()).toBeNull();
    room.add(fakeLink().link);
    expect(room.left()).toBe(LOBBY_SECONDS); // a full two minutes again
  });

  it("turns away a seventh phone, and keeps sides to three", () => {
    const { room } = lobby();
    const links = Array.from({ length: 6 }, fakeLink);
    for (const l of links) room.add(l.link);
    expect(room.members).toHaveLength(6);
    expect(links[5].last("full")).toBeTruthy();
    // Three a side: nobody can move over.
    links[0].say({ t: "seat", side: 0 });
    expect(room.members.filter((m) => m.side === 0)).toHaveLength(3);
  });

  it("a friend who leaves gives up their seat", () => {
    const { room } = lobby();
    const a = fakeLink();
    room.add(a.link);
    a.link.close();
    expect(room.members.map((m) => m.id)).toEqual([0]);
  });
});

import { describe, expect, it } from "vitest";
import { buildSetup, defaultLineup, levelFor, unit, validLineup } from "@/components/arcade/setup";
import { nextStop, parseProgress, recordResult } from "@/components/arcade/progress";
import { arcadeData } from "@/lib/stats/arcade";
import { CLUB } from "../helpers/builders";
import { games, lines } from "../helpers/club-fixtures";

const data = arcadeData(lines.filter((l) => l.clubId === CLUB), games, null, CLUB, [], lines);

describe("match setup", () => {
  it("maps 60–99 ratings to 0..1", () => {
    expect(unit(60)).toBeCloseTo(0.05);
    expect(unit(80)).toBeCloseTo(0.5);
    expect(unit(99)).toBeCloseTo(0.95);
  });

  it("puts you first in the default line", () => {
    const me = data.skaters[2].id;
    expect(defaultLineup(data, me)[0]).toBe(me);
    expect(defaultLineup(data, null)).toEqual(data.skaters.slice(0, 3).map((s) => s.id));
  });

  it("repairs a saved line-up with unknown or doubled players", () => {
    const l = validLineup(data, ["nope", data.skaters[1].id, data.skaters[1].id], null);
    expect(l).toHaveLength(3);
    expect(new Set(l).size).toBe(3);
    expect(l[0]).toBe(data.skaters[1].id);
  });

  it("builds both teams with real names and marks you", () => {
    const opp = data.opponents.find((o) => o.name === "INFERNAL LEGION")!;
    const me = data.skaters[0].id;
    const s = buildSetup(data, opp, defaultLineup(data, me), null, me, { insane: true, stop: 2, seed: 1 });
    expect(s.home.skaters).toHaveLength(3);
    expect(s.home.skaters[0]).toMatchObject({ id: me, you: true });
    expect(s.away.skaters.map((p) => p.name)).toEqual(opp.skaters.map((p) => p.name));
    expect(s.away.level).toBeCloseTo(levelFor(opp, 2));
    expect(s.insane).toBe(true);
  });

  it("harder clubs get a smarter AI", () => {
    const sorted = [...data.opponents].sort((a, b) => a.difficulty - b.difficulty);
    expect(levelFor(sorted.at(-1)!, null)).toBeGreaterThan(levelFor(sorted[0], null));
  });
});

describe("progress", () => {
  it("survives junk in storage", () => {
    expect(parseProgress("{nope")).toMatchObject({ avenged: [], wins: 0 });
    expect(parseProgress(JSON.stringify({ avenged: [1, "x", 2], wins: 3, muted: true }))).toMatchObject({ avenged: [1, 2], wins: 3, muted: true });
  });

  it("avenges a club only with a tour win", () => {
    let p = parseProgress(null);
    p = recordResult(p, 5, false, true);
    p = recordResult(p, 6, true, false);
    expect(p.avenged).toEqual([]);
    p = recordResult(p, 5, true, true);
    p = recordResult(p, 5, true, true);
    expect(p).toMatchObject({ avenged: [5], wins: 3, losses: 1 });
    expect(nextStop([5, 7, 9], p.avenged)).toBe(7);
    expect(nextStop([5], p.avenged)).toBeNull();
  });
});

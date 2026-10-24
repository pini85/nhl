import { describe, expect, it } from "vitest";
import { activeStreaks, bestTeammates, lastNight, nextMilestones, recordStanding, rosterChoices, vsTeam } from "@/lib/stats/personal";
import { clubRecords } from "@/lib/stats/records";
import type { ExtraStats } from "@/lib/stats/types";
import { CLUB, game, line } from "../helpers/builders";

const NOW = new Date("2026-10-24T12:00:00Z");

const extra = (id: string, stats: Partial<ExtraStats>): ExtraStats => ({
  eaPlayerId: id,
  playerName: id,
  coversFrom: new Date("2026-09-01"),
  gp: 0,
  goals: 0,
  assists: 0,
  plusMinus: 0,
  shots: 0,
  hits: 0,
  pim: 0,
  ppg: 0,
  shg: 0,
  takeaways: 0,
  giveaways: 0,
  blockedShots: 0,
  interceptions: 0,
  passAttempts: 0,
  passes: 0,
  ...stats,
});

describe("rosterChoices", () => {
  it("puts recent regulars first and the rest behind 'Show everyone'", () => {
    const g = [game("old", "2026-07-01T19:00:00Z"), game("mid", "2026-10-01T19:00:00Z"), game("new", "2026-10-22T19:00:00Z")];
    const l = [
      line("old", "x", "Xavier"),
      line("mid", "a", "Amy", { position: "defenseMen" }),
      line("new", "b", "Bob"),
      line("new", "g", "GuestGuy", { isGuest: true }),
    ];
    const { main, rest } = rosterChoices(l, g, CLUB, NOW);
    expect(main.map((c) => c.name)).toEqual(["Bob", "Amy"]);
    expect(main[1]).toMatchObject({ eaPlayerId: "a", position: "defenseMen", gp: 1 });
    expect(rest.map((c) => c.name).sort()).toEqual(["GuestGuy", "Xavier"]);
  });

  it("counts games without a box score in games played", () => {
    const g = [game("new", "2026-10-22T19:00:00Z")];
    const { main } = rosterChoices([line("new", "b", "Bob")], g, CLUB, NOW, [extra("b", { gp: 9 })]);
    expect(main[0].gp).toBe(10);
  });
});

describe("lastNight", () => {
  const g = [
    game("n1a", "2026-10-15T19:00:00Z", { outcome: "W" }),
    game("n2a", "2026-10-22T19:00:00Z", { outcome: "W" }),
    game("n2b", "2026-10-22T19:40:00Z", { outcome: "L" }),
  ];
  const l = [
    line("n1a", "b", "Bob", { goals: 0, assists: 0 }),
    line("n2a", "b", "Bob", { goals: 2, assists: 1, plusMinus: 1 }),
    line("n2b", "b", "Bob", { goals: 0, assists: 1, plusMinus: 1 }),
    line("n2a", "k", "Keeper", { position: "goalie", glSaves: 18, glShots: 20, glGa: 2 }),
  ];

  it("totals your latest night and compares it with your average", () => {
    expect(lastNight(l, g, "b", CLUB)).toMatchObject({
      nightKey: "2026-10-22",
      gp: 2,
      goals: 2,
      assists: 2,
      plusMinus: 2,
      wins: 1,
      losses: 1,
      goalie: null,
    });
    // 2 pts/game that night vs 4/3 overall
    expect(lastNight(l, g, "b", CLUB)!.pointsVsAvg).toBeCloseTo(2 - 4 / 3);
  });

  it("gives goalies their saves", () => {
    const n = lastNight(l, g, "k", CLUB)!;
    expect(n.goalie).toEqual({ saves: 18, shots: 20, ga: 2 });
    expect(n.pointsVsAvg).toBeNull();
  });

  it("is null for someone who never played", () => expect(lastNight(l, g, "nobody", CLUB)).toBeNull());
});

describe("activeStreaks", () => {
  const g = ["1", "2", "3", "4"].map((d) => game(`g${d}`, `2026-10-1${d}T19:00:00Z`));
  it("reports streaks that are still going", () => {
    const l = [
      line("g1", "b", "Bob", { goals: 0 }),
      line("g2", "b", "Bob", { goals: 1 }),
      line("g3", "b", "Bob", { assists: 1 }),
      line("g4", "b", "Bob", { goals: 1 }),
    ];
    expect(activeStreaks(l, g, "b")).toEqual([
      { key: "games", length: 4 },
      { key: "points", length: 3 },
    ]);
  });
  it("drops broken streaks", () => {
    const l = [line("g3", "b", "Bob", { goals: 1 }), line("g4", "b", "Bob", { goals: 0 })];
    expect(activeStreaks(l, g, "b")).toEqual([{ key: "games", length: 2 }]);
  });
});

describe("nextMilestones", () => {
  it("counts games without a box score and picks the closest", () => {
    const l = [line("g1", "b", "Bob", { goals: 2, hits: 10 })];
    const next = nextMilestones(l, [extra("b", { gp: 20, goals: 45, assists: 3 })], "b");
    expect(next[0]).toEqual({ stat: "goals", target: 50, remaining: 3 });
    expect(next).toContainEqual({ stat: "games", target: 25, remaining: 4 });
    expect(next.length).toBeLessThanOrEqual(3);
  });
  it("skips stats a player has none of yet", () => {
    const next = nextMilestones([line("g1", "k", "Keeper", { position: "goalie" })], [], "k");
    expect(next.map((n) => n.stat)).toEqual(["games"]);
  });
});

describe("recordStanding", () => {
  const g = [game("g1", "2026-10-11T19:00:00Z"), game("g2", "2026-10-12T19:00:00Z")];
  it("lists records you hold and ones within 15%", () => {
    const l = [line("g1", "a", "Amy", { hits: 14, goals: 1 }), line("g2", "b", "Bob", { hits: 12, goals: 2 })];
    const s = recordStanding(clubRecords(l, g, CLUB), l, "b");
    expect(s.held.map((r) => r.key)).toContain("goals-game");
    expect(s.nearMisses).toContainEqual(expect.objectContaining({ best: 12, short: 2, record: expect.objectContaining({ key: "hits-game" }) }));
  });
  it("leaves out records further than 15% away", () => {
    const l = [line("g1", "a", "Amy", { hits: 14 }), line("g2", "b", "Bob", { hits: 11 })];
    expect(recordStanding(clubRecords(l, g, CLUB), l, "b").nearMisses).toEqual([]);
  });
});

describe("vsTeam", () => {
  const g = [game("g1", "2026-10-11T19:00:00Z"), game("g2", "2026-10-12T19:00:00Z")];
  const l = [
    line("g1", "b", "Bob", { goals: 2, hits: 4 }),
    line("g1", "a", "Amy", { goals: 0, hits: 2 }),
    line("g2", "k", "Keeper", { position: "goalie", glSaves: 9, glShots: 10, glGa: 1 }),
  ];
  it("compares a skater's per-game numbers with the team's", () => {
    const v = vsTeam(l, g, "b", CLUB);
    expect(v.goalie).toBeNull();
    expect(v.skater).toContainEqual({ stat: "Goals", mine: 2, team: 1, better: "higher" });
    expect(v.skater).toContainEqual({ stat: "Hits", mine: 4, team: 3, better: "higher" });
  });
  it("gives a goalie goalie numbers and no NaN", () => {
    const v = vsTeam(l, g, "k", CLUB);
    expect(v.skater).toBeNull();
    expect(v.goalie).toContainEqual({ stat: "Save %", mine: 90, team: 90, better: "higher" });
    for (const r of v.goalie!) expect(Number.isFinite(r.mine) && Number.isFinite(r.team)).toBe(true);
  });
});

describe("bestTeammates", () => {
  it("ranks teammates by win % with at least 3 games together", () => {
    const g = ["1", "2", "3", "4"].map((d) => game(`g${d}`, `2026-10-1${d}T19:00:00Z`, { outcome: d === "4" ? "L" : "W" }));
    const l = [
      ...g.map((x) => line(x.matchId, "b", "Bob")),
      ...g.slice(0, 3).map((x) => line(x.matchId, "a", "Amy")),
      ...g.slice(1).map((x) => line(x.matchId, "c", "Cid")),
      line("g1", "d", "Dan"),
    ];
    expect(bestTeammates(l, g, "b", CLUB)).toEqual([
      { eaPlayerId: "a", name: "Amy", gp: 3, winPct: 1 },
      { eaPlayerId: "c", name: "Cid", gp: 3, winPct: 2 / 3 },
    ]);
  });
});

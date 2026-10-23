import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toRosterMember } from "@/lib/ea/normalize";
import type { OpponentProfile } from "@/lib/opponents/profile";
import { dangerousPlayers, headToHead, nemesis, ourAverages, playStyle, punchingBags, quitRate } from "@/lib/stats/opponents";
import type { GameLite } from "@/lib/stats/types";
import { games, lines, normalized } from "../helpers/club-fixtures";

const extra = (clubId: number, gf: number, ga: number, iso: string): GameLite => ({
  matchId: `x-${clubId}-${iso}`,
  playedAt: new Date(iso),
  opponentClubId: clubId,
  opponentName: null,
  goalsFor: gf,
  goalsAgainst: ga,
  outcome: gf > ga ? "W" : "L",
  overtime: false,
  dnf: "none",
  source: "full",
  matchType: "gameType5",
});

describe("headToHead", () => {
  it("one row per opponent, latest first", () => {
    const h = headToHead(games);
    expect(h).toHaveLength(10);
    expect(h.every((x) => x.gp === 1)).toBe(true);
    expect(h[0]).toMatchObject({ clubId: 1808, name: "INFERNAL LEGION", wins: 0, losses: 1, goalsFor: 2, goalsAgainst: 4, goalDiff: -2, winPct: 0 });
  });
  it("keeps the latest known name", () => {
    const h = headToHead([...games, extra(1808, 1, 0, "2026-10-01T20:00:00Z")]);
    expect(h.find((x) => x.clubId === 1808)).toMatchObject({ name: "INFERNAL LEGION", gp: 2, wins: 1, losses: 1 });
  });
});

describe("nemesis and punching bags", () => {
  it("need at least 2 games", () => {
    expect(nemesis(headToHead(games))).toEqual([]);
    expect(punchingBags(headToHead(games))).toEqual([]);
  });
  it("rank by win %, then goal difference, then games", () => {
    const g = [
      extra(1, 0, 3, "2026-10-01T20:00:00Z"),
      extra(1, 0, 3, "2026-10-02T20:00:00Z"), // 0-2, GD -6
      extra(2, 0, 1, "2026-10-03T20:00:00Z"),
      extra(2, 0, 1, "2026-10-04T20:00:00Z"), // 0-2, GD -2
      extra(3, 5, 0, "2026-10-05T20:00:00Z"),
      extra(3, 5, 0, "2026-10-06T20:00:00Z"), // 2-0, GD +10
    ];
    expect(nemesis(headToHead(g)).map((x) => x.clubId)).toEqual([1, 2, 3]);
    expect(punchingBags(headToHead(g)).map((x) => x.clubId)).toEqual([3, 2, 1]);
  });
});

describe("dangerousPlayers", () => {
  it("lists their scorers against us", () => {
    expect(dangerousPlayers(lines, 1808)[0]).toEqual({ name: "Tazzman-Devil", gp: 1, goals: 2, assists: 2, points: 4 });
  });
  it("is empty for a club we never played", () => expect(dangerousPlayers(lines, 999)).toEqual([]));
});

describe("quitRate", () => {
  const members = (
    JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/members-stats.json", "utf8")).members as Record<string, unknown>[]
  ).map(toRosterMember);
  it("sums games not completed over games played", () => expect(quitRate(members)).toBeCloseTo(54 / 572, 4));
  it("null without data", () => {
    expect(quitRate(null)).toBeNull();
    expect(quitRate([])).toBeNull();
  });
});

describe("playStyle", () => {
  const profile = (avg: Partial<OpponentProfile["avg"]>): OpponentProfile => ({
    matches: 5,
    avg: { shots: 20, hits: 20, pim: 10, faceoffPct: 0.5, passPct: 0.7, goalsFor: 3, goalsAgainst: 3, ...avg },
    humanGoalieShare: 0,
    lineup: [],
    platforms: {},
    avgPlayerLevel: 0,
    usualHourCet: null,
  });
  const ours = { shots: 20, hits: 20, pim: 10, faceoffPct: 0.5, passPct: 0.7 };
  it("labels physical and disciplined clubs", () => {
    const s = playStyle(profile({ hits: 30, pim: 2 }), ours);
    expect(s).toContain("Very physical");
    expect(s).toContain("Disciplined");
  });
  it("no labels for an average club", () => expect(playStyle(profile({}), ours)).toEqual([]));
  it("labels shooters, penalties, faceoffs, passing", () => {
    expect(playStyle(profile({ shots: 30, pim: 15, faceoffPct: 0.6, passPct: 0.8 }), ours)).toEqual([
      "Shoots a lot",
      "Takes penalties",
      "Strong on faceoffs",
      "Passes well",
    ]);
  });
});

describe("ourAverages", () => {
  it("per-game averages from our club rows", () => {
    const clubs = normalized.flatMap((n) => n.clubs);
    const a = ourAverages(clubs, 56507);
    const ours = clubs.filter((c) => c.clubId === 56507);
    expect(a.shots).toBeCloseTo(ours.reduce((s, c) => s + c.shots, 0) / ours.length, 5);
    expect(a.faceoffPct).toBeGreaterThan(0);
  });
  it("zeros without data", () => expect(ourAverages([], 56507)).toEqual({ shots: 0, hits: 0, pim: 0, faceoffPct: 0, passPct: 0 }));
});

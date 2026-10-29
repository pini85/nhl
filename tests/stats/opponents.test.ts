import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toRosterMember } from "@/lib/ea/normalize";
import { toClubSummary } from "@/lib/ea/api";
import type { OpponentProfile } from "@/lib/opponents/profile";
import { dangerousPlayers, headToHead, nemesis, ourAverages, playStyle, punchingBags, clubTotals, recentFromSummary, rosterLeaders, rosterStats } from "@/lib/stats/opponents";
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
  const d = (n: number) => `2026-10-${String(n).padStart(2, "0")}T20:00:00Z`;
  const ids = (h: { clubId: number }[]) => h.map((x) => x.clubId);

  it("with only single games, the biggest losses and wins", () => {
    // fixtures: 7 wins, 3 losses, every club once
    expect(ids(nemesis(headToHead(games)))).toEqual([7823, 1616, 1808]); // 0-5, 2-5, 2-4
    expect(nemesis(headToHead(games))[0]).toMatchObject({ goalDiff: -5 });
    expect(punchingBags(headToHead(games))[0]).toMatchObject({ clubId: 3592, goalDiff: 6 }); // 7-1
  });
  it("a nemesis has a losing record against us, a punching bag a winning one", () => {
    const g = [extra(1, 3, 0, d(1)), extra(1, 2, 1, d(2)), extra(2, 1, 0, d(3)), extra(2, 0, 4, d(4)), extra(3, 0, 2, d(5)), extra(3, 1, 2, d(6))];
    expect(ids(nemesis(headToHead(g)))).toEqual([3]); // 2 is 1-1: neither
    expect(ids(punchingBags(headToHead(g)))).toEqual([1]);
  });
  it("record first, then goal difference", () => {
    const g = [
      extra(1, 0, 1, d(1)), extra(1, 0, 1, d(2)), extra(1, 0, 1, d(3)), // 0-3, -3
      extra(2, 1, 0, d(4)), extra(2, 0, 5, d(5)), extra(2, 0, 4, d(6)), // 1-2, -8
      extra(3, 0, 2, d(7)), extra(3, 0, 6, d(8)), extra(3, 0, 1, d(9)), // 0-3, -9
    ];
    expect(ids(nemesis(headToHead(g)))).toEqual([3, 1, 2]);
    const flipped = g.map((x) => ({ ...x, goalsFor: x.goalsAgainst, goalsAgainst: x.goalsFor, outcome: x.outcome === "W" ? ("L" as const) : ("W" as const) }));
    expect(ids(punchingBags(headToHead(flipped)))).toEqual([3, 1, 2]);
  });
  it("clubs played twice or more come before single games", () => {
    const g = [extra(1, 0, 1, d(1)), extra(1, 0, 1, d(2)), extra(2, 0, 8, d(3)), extra(3, 0, 2, d(4))];
    expect(ids(nemesis(headToHead(g)))).toEqual([1, 2, 3]);
  });
  it("ties go to goals scored, then the most recent game", () => {
    expect(ids(punchingBags(headToHead([extra(1, 2, 1, d(1)), extra(2, 4, 3, d(2))])))).toEqual([2, 1]);
    expect(ids(nemesis(headToHead([extra(1, 1, 2, d(1)), extra(2, 0, 1, d(2))])))).toEqual([2, 1]); // fewer scored is worse
    expect(ids(nemesis(headToHead([extra(1, 0, 5, d(1)), extra(2, 0, 5, d(2))])))).toEqual([2, 1]);
  });
  it("keeps the top 3", () => {
    const g = [1, 2, 3, 4].map((c) => extra(c, 0, c, d(c)));
    expect(ids(nemesis(headToHead(g)))).toEqual([4, 3, 2]);
  });
});

describe("dangerousPlayers", () => {
  it("lists their scorers against us", () => {
    expect(dangerousPlayers(lines, 1808)[0]).toEqual({ name: "Tazzman-Devil", gp: 1, goals: 2, assists: 2, points: 4 });
  });
  it("is empty for a club we never played", () => expect(dangerousPlayers(lines, 999)).toEqual([]));
});

describe("clubTotals", () => {
  const entry = JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/clubs-search.json", "utf8"))["56507"];
  // Same shape the collector saves: raw = { info: summary.raw } = { info: { season, info } }.
  const raw = { info: toClubSummary(56507, entry, entry.clubInfo).raw };
  it("reads games, goals and history from the club info", () => {
    const t = clubTotals({ wins: 11, losses: 9, otl: 0, raw })!;
    expect(t).toMatchObject({
      gp: 20, wins: 11, winPct: 0.55, goalsFor: 66, goalsAgainst: 57, goalDiff: 9,
      seasons: 2, titles: 1, promotions: 2, relegations: 0, rankingPoints: 76,
    });
    expect(t.goalsForPerGame).toBeCloseTo(3.3, 5);
  });
  it("null when the club has no games", () => expect(clubTotals({ wins: 0, losses: 0, otl: 0, raw: {} })).toBeNull());
  it("copes with a missing raw blob", () => expect(clubTotals({ wins: 1, losses: 0, otl: 0, raw: null })).toMatchObject({ gp: 1, goalsFor: 0 }));

  it("lists their last games from the summary, newest first", () => {
    const r = recentFromSummary(raw);
    expect(r).toHaveLength(10);
    expect(r[0]).toMatchObject({ opponentClubId: 1808, goalsFor: 2, goalsAgainst: 4, outcome: "L" });
    expect(recentFromSummary(null)).toEqual([]);
  });
});

describe("rosterLeaders", () => {
  const members = (
    JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/members-stats.json", "utf8")).members as Record<string, unknown>[]
  ).map(toRosterMember);
  it("names the top player per category", () => {
    const l = Object.fromEntries(rosterLeaders(members).map((x) => [x.label, `${x.name} ${x.value}`]));
    expect(l.Goals).toBe("ThePooker 182");
    expect(l.Assists).toBe("Popomasta-SMB 169");
    expect(l.Hits).toBe("Popomasta-SMB 430");
    expect(l["+/-"]).toBe("mike_v_75 +1");
  });
  it("skips categories nobody has", () => {
    const m = toRosterMember({ name: "x", skgp: "3", skplusmin: "-2" });
    expect(rosterLeaders([m]).map((x) => x.label)).not.toContain("+/-");
    expect(rosterLeaders(null)).toEqual([]);
  });
});

describe("rosterStats", () => {
  const members = (
    JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/members-stats.json", "utf8")).members as Record<string, unknown>[]
  ).map(toRosterMember);
  it("lists skaters by points with per-game rate", () => {
    const { skaters, goalies } = rosterStats(members);
    expect(skaters.map((s) => s.name)).toEqual(["ThePooker", "puck_control", "Popomasta-SMB", "mike_v_75"]);
    expect(skaters[0]).toMatchObject({ gp: 189, goals: 182, assists: 160, points: 342, plusMinus: -187 });
    expect(skaters[0].pointsPerGame).toBeCloseTo(342 / 189, 5);
    expect(goalies).toEqual([]);
  });
  it("picks up anyone who played in net", () => {
    const g = toRosterMember({ name: "wall", favoritePosition: "goalie", glgp: "10", glwins: "6", glsavepct: "0.812", glgaa: "2.40", glso: "1" });
    expect(rosterStats([g]).goalies).toEqual([{ name: "wall", gp: 10, wins: 6, savePct: 0.812, gaa: 2.4, shutouts: 1 }]);
  });
  it("empty without data", () => expect(rosterStats(null)).toEqual({ skaters: [], goalies: [] }));
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
  const ours = { shots: 20, hits: 20, pim: 10, faceoffPct: 0.5, passPct: 0.7, goalsFor: 3, goalsAgainst: 3, shotsAgainst: 20, ppPct: 0.2, shootingPct: 0.15 };
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
    expect(a.goalsFor).toBeCloseTo(ours.reduce((s, c) => s + c.score, 0) / ours.length, 5);
    const against = ours.reduce((s, c) => s + clubs.find((o) => o.matchId === c.matchId && o.clubId !== 56507)!.score, 0);
    expect(a.goalsAgainst).toBeCloseTo(against / ours.length, 5);
    expect(a.shotsAgainst).toBeGreaterThan(0);
  });
  it("zeros without data", () =>
    expect(ourAverages([], 56507)).toEqual({
      shots: 0, hits: 0, pim: 0, faceoffPct: 0, passPct: 0, goalsFor: 0, goalsAgainst: 0, shotsAgainst: 0, ppPct: 0, shootingPct: 0,
    }));
});

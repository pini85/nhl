import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toRosterMember } from "@/lib/ea/normalize";
import { extrasInRange, filterGames, hotPlayers, playerBadge, playerTotals } from "@/lib/stats/players";
import type { ExtraStats } from "@/lib/stats/types";
import { games, lines } from "../helpers/club-fixtures";

const roster = (
  JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/members-stats.json", "utf8")).members as Record<string, unknown>[]
).map(toRosterMember);

describe("playerTotals", () => {
  const { skaters, goalies } = playerTotals(lines, games, roster, 56507);

  it("ranks skaters by club-only points", () => {
    expect(skaters[0]).toMatchObject({ name: "ThePooker", gp: 9, goals: 11, assists: 10, points: 21, plusMinus: 1, badge: "member" });
    expect(skaters[1]).toMatchObject({ name: "puck_control", points: 20 });
  });

  it("badges guests and members", () => {
    expect(skaters.find((s) => s.name === "Kai_Fretwell18")?.badge).toBe("guest");
    expect(skaters.find((s) => s.name === "mike_v_75")?.badge).toBe("member");
  });

  it("totals goalies", () => {
    const g = goalies.find((x) => x.name === "Liengutten")!;
    expect(g).toMatchObject({ gp: 4, saves: 38, shotsAgainst: 48, goalsAgainst: 10 });
    expect(g.savePct).toBeCloseTo(0.7917, 3);
  });

  it("ignores opponent lines", () => {
    expect(skaters.some((s) => s.name === "Tazzman-Devil")).toBe(false);
  });
});

describe("playerBadge", () => {
  it("former when not on roster but played as non-guest", () => {
    expect(playerBadge("1", "someone", roster, true)).toBe("former");
  });
  it("guest when never a non-guest", () => expect(playerBadge("1", "someone", roster, false)).toBe("guest"));
  it("guest when no roster known and never non-guest", () => expect(playerBadge("1", "x", null, false)).toBe("guest"));
});

describe("hotPlayers", () => {
  it("top 3 over the newest 5 full games", () => {
    const hot = hotPlayers(lines, games, 56507);
    expect(hot.slice(0, 2).map((h) => h.name).sort()).toEqual(["ThePooker", "puck_control"]);
    expect(hot[0]).toMatchObject({ goals: 7, assists: 9, points: 16, gp: 5 });
    expect(hot[2]).toMatchObject({ name: "Kai_Fretwell18", points: 14 });
  });
});

describe("filterGames", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("last10 ignores summary games", () => {
    const ids = filterGames(games, "last10", now);
    expect(ids.size).toBe(9);
    expect(ids.has("summary-1974")).toBe(false);
  });
  it("30d includes everything recent", () => expect(filterGames(games, "30d", now).size).toBe(10));
  it("30d excludes old games", () => expect(filterGames(games, "30d", new Date("2027-01-01")).size).toBe(0));
});

describe("playerTotals with extra stats from games without a box score", () => {
  const extra = (o: Partial<ExtraStats>): ExtraStats => ({
    eaPlayerId: "802564056", playerName: "Popomasta-SMB", coversFrom: new Date("2026-10-15T19:42:49Z"),
    gp: 0, goals: 0, assists: 0, plusMinus: 0, shots: 0, hits: 0, pim: 0, ppg: 0, shg: 0, takeaways: 0, giveaways: 0, ...o,
  });

  it("adds them to the player's box-score totals", () => {
    const { skaters } = playerTotals(lines, games, roster, 56507, [extra({ gp: 11, goals: 2, assists: 3, plusMinus: 4, shots: 14, hits: 7 })]);
    expect(skaters.find((s) => s.name === "Popomasta-SMB")).toMatchObject({
      gp: 14, goals: 2, assists: 4, points: 6, plusMinus: -1, shots: 15, hits: 11, badge: "member",
    });
  });

  it("recomputes rates and ranking from the combined totals", () => {
    const { skaters } = playerTotals(lines, games, roster, 56507, [extra({ gp: 11, goals: 20, shots: 20 })]);
    expect(skaters[0].name).toBe("Popomasta-SMB");
    expect(skaters[0].shotPct).toBeCloseTo((20 / 21) * 100, 5);
    expect(skaters[0].pointsPerGame).toBeCloseTo(21 / 14, 5);
  });

  it("lists a player who only has extra stats", () => {
    const { skaters } = playerTotals(lines, games, roster, 56507, [extra({ eaPlayerId: "new", playerName: "Newbie", gp: 2, goals: 1 })]);
    expect(skaters.find((s) => s.eaPlayerId === "new")).toMatchObject({ name: "Newbie", gp: 2, goals: 1, points: 1 });
  });
});

describe("extrasInRange", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const e = { coversFrom: new Date("2026-10-15T19:42:49Z") } as ExtraStats;
  it("all time always counts them", () => expect(extrasInRange([e], "all", now)).toEqual([e]));
  it("30 days counts them while their oldest game is inside the window", () => {
    expect(extrasInRange([e], "30d", now)).toEqual([e]);
    expect(extrasInRange([e], "30d", new Date("2026-11-20T12:00:00Z"))).toEqual([]);
  });
  it("last 10 is box scores only", () => expect(extrasInRange([e], "last10", now)).toEqual([]));
});

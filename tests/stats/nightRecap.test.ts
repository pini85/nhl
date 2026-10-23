import { describe, expect, it } from "vitest";
import { nightRecap } from "@/lib/stats/nightRecap";
import { games, lines } from "../helpers/club-fixtures";

describe("nightRecap", () => {
  it("summarizes Thu Oct 22", () => {
    const r = nightRecap("2026-10-22", games, lines, 56507)!;
    expect(r.night.games).toHaveLength(7);
    expect(r.mvp?.playerName).toBe("puck_control");
    expect(r.stars[0]).toMatchObject({ name: "puck_control", points: 18 });
    expect(r.stars).toHaveLength(3);
    expect(r.hasPlayerData).toBe(true);
    expect(r.leaders.hits?.value).toBeGreaterThan(0);
    expect(r.leaders.goalie).not.toBeNull();
  });

  it("unknown night is null", () => expect(nightRecap("2020-01-01", games, lines, 56507)).toBeNull());

  it("a night of score-only games has no player data", () => {
    const summaryOnly = [{ ...games.find((g) => g.source === "summary")!, playedAt: new Date("2026-10-10T19:00:00Z") }];
    const r = nightRecap("2026-10-10", summaryOnly, lines, 56507)!;
    expect(r.hasPlayerData).toBe(false);
    expect(r.stars).toEqual([]);
    expect(r.mvp).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { clubFinals } from "@/lib/stats/finals";

const g = (matchType: string, outcome: "W" | "L", overtime = false) => ({ matchType, outcome, overtime });

describe("clubFinals", () => {
  it("reads EA's all-time counters and counts only playoff games", () => {
    const raw = { clubfinalsplayed: "4", cupsEntered: "4", totalCupsWon: "1", cupsWon2: "1" };
    const games = [g("gameType10", "W"), g("gameType10", "L"), g("gameType10", "L", true), g("gameType5", "W"), g("club_private", "W")];
    expect(clubFinals(raw, games)).toEqual({ appearances: 4, cups: 1, record: { wins: 1, losses: 1, otLosses: 1 }, games: 3 });
  });
  it("falls back to per-level cup counts and handles missing raw", () => {
    expect(clubFinals({ cupsWon1: "1", cupsWon3: "2" }, []).cups).toBe(3);
    expect(clubFinals(null, [])).toEqual({ appearances: 0, cups: 0, record: { wins: 0, losses: 0, otLosses: 0 }, games: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { clubFinals } from "@/lib/stats/finals";
import { game } from "../helpers/builders";

describe("clubFinals", () => {
  it("reads EA's all-time counters and counts only playoff games", () => {
    const raw = { clubfinalsplayed: "4", cupsEntered: "4", totalCupsWon: "1", cupsWon2: "1" };
    const games = [
      game("a", "2026-10-20T20:00:00Z", { matchType: "gameType10", outcome: "W" }),
      game("b", "2026-10-20T20:30:00Z", { matchType: "gameType10", outcome: "W" }),
      game("c", "2026-10-20T21:00:00Z", { matchType: "gameType10", outcome: "L", overtime: true }),
      game("d", "2026-10-27T20:00:00Z", { matchType: "gameType10", outcome: "L" }),
      game("e", "2026-10-27T20:30:00Z", { matchType: "gameType5", outcome: "W" }),
      game("f", "2026-10-27T21:00:00Z", { matchType: "club_private", outcome: "W" }),
    ];
    const f = clubFinals(raw, games);
    expect(f.runs.map((r) => [r.key, r.games.length, r.wins])).toEqual([["2026-10-27", 1, 0], ["2026-10-20", 3, 2]]);
    expect({ ...f, runs: undefined }).toEqual({
      appearances: 4,
      cups: 1,
      record: { wins: 2, losses: 1, otLosses: 1 },
      games: 4,
      furthestRound: 3,
      runs: undefined,
    });
  });
  it("falls back to per-level cup counts and handles missing raw", () => {
    expect(clubFinals({ cupsWon1: "1", cupsWon3: "2" }, []).cups).toBe(3);
    expect(clubFinals(null, [])).toEqual({ appearances: 0, cups: 0, record: { wins: 0, losses: 0, otLosses: 0 }, games: 0, furthestRound: 0, runs: [] });
  });
});

import { describe, expect, it } from "vitest";
import { gameAwards } from "@/lib/stats/awards";
import { clubRecords } from "@/lib/stats/records";
import { playerForm } from "@/lib/stats/trends";
import type { GameLite, PlayerLine } from "@/lib/stats/types";
import { games, lines } from "../helpers/club-fixtures";

// A score-only game where we only know one player's goals and assists (typed in from the game).
const old: GameLite = { ...games.find((g) => g.source === "full")!, matchId: "manual-35445-1", source: "summary", playedAt: new Date("2026-10-15T20:12:34Z"), goalsFor: 8, goalsAgainst: 1, outcome: "W" };
const base = lines.find((l) => l.playerName === "puck_control")!;
const zero = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, typeof v === "number" ? 0 : v])) as PlayerLine;
const partial: PlayerLine = { ...zero, clubId: 56507, matchId: old.matchId, goals: 5, assists: 3 };

describe("a known player line in a score-only game", () => {
  it("counts for single-game records", () => {
    const recs = clubRecords([...lines, partial], [...games, old], 56507);
    expect(recs.find((r) => r.key === "goals-game")).toMatchObject({ value: 5, holder: "puck_control", matchId: old.matchId });
    expect(recs.find((r) => r.key === "points-game")).toMatchObject({ value: 8, holder: "puck_control" });
  });
  it("earns awards", () => {
    expect(gameAwards([partial], old, [], 56507).map((a) => a.key).sort()).toEqual(["hattrick", "playmaker"]);
  });
  it("stays out of the form chart and streaks, which need every game", () => {
    expect(playerForm([...lines, partial].filter((l) => l.eaPlayerId === base.eaPlayerId), [...games, old]).some((f) => f.matchId === old.matchId)).toBe(false);
    const streakBefore = clubRecords(lines, games, 56507).find((r) => r.key === "point-streak");
    expect(clubRecords([...lines, partial], [...games, old], 56507).find((r) => r.key === "point-streak")).toEqual(streakBefore);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EaMatchListSchema } from "@/lib/ea/schemas";
import { buildProfile } from "@/lib/opponents/profile";

const recovered = EaMatchListSchema.parse(
  JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/matches-recovered-from-opponents.json", "utf8")),
);

describe("buildProfile", () => {
  it("summarizes a club's recent matches", () => {
    const ms = recovered.filter((m) => "1616" in m.clubs);
    const p = buildProfile(ms, 1616)!;
    expect(p.matches).toBe(ms.length);
    expect(p.humanGoalieShare).toBeGreaterThanOrEqual(0);
    expect(p.humanGoalieShare).toBeLessThanOrEqual(1);
    const names = new Set(ms.flatMap((m) => Object.values(m.players["1616"] ?? {}).map((x) => x.playername)));
    expect(p.lineup).toHaveLength(names.size);
    expect(p.avg.shots).toBeGreaterThan(0);
    expect(p.usualHourCet).not.toBeNull();
    expect(p.recentGames).toHaveLength(ms.length);
    const g = p.recentGames![0];
    expect(g.opponentClubId).not.toBe(1616);
    expect(g.opponentName).toBeTruthy();
    expect(["W", "L"]).toContain(g.outcome);
    expect(p.recentGames!.map((x) => x.playedAt)).toEqual([...p.recentGames!.map((x) => x.playedAt)].sort().reverse());
    expect(p.avg.shotsAgainst).toBeGreaterThan(0);
  });

  it("returns null without matches", () => expect(buildProfile([], 1)).toBeNull());

  it("handles a club with no player data", () => {
    const m = structuredClone(recovered[0]);
    m.players = {};
    const club = Object.keys(m.clubs).find((k) => k !== "56507")!;
    const p = buildProfile([m], Number(club))!;
    expect(p.lineup).toEqual([]);
    expect(p.humanGoalieShare).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { groupGameNights } from "@/lib/stats/nights";
import { divisionJourney, heat, nightSeries, playerForm } from "@/lib/stats/trends";
import type { GameLite, PlayerLine } from "@/lib/stats/types";
import { games, lines } from "../helpers/club-fixtures";

describe("nightSeries", () => {
  it("one point per night, oldest first", () => {
    expect(nightSeries(groupGameNights(games)).map((p) => [p.label, p.goalsFor, p.goalsAgainst])).toEqual([
      ["Sun Oct 18", 0, 5],
      ["Tue Oct 20", 8, 2],
      ["Thu Oct 22", 29, 20],
    ]);
  });
  it("keeps the newest 12 nights", () => {
    const many: GameLite[] = Array.from({ length: 15 }, (_, i) => ({
      ...games[0],
      matchId: `n${i}`,
      playedAt: new Date(Date.UTC(2026, 8, 1 + i * 2, 19)),
    }));
    const s = nightSeries(groupGameNights(many));
    expect(s).toHaveLength(12);
    expect(s.at(-1)?.key).toBe("2026-09-29");
  });
});

describe("playerForm", () => {
  it("last games oldest first, skater games only", () => {
    const f = playerForm(lines.filter((l) => l.eaPlayerId === "828785353"), games);
    expect(f).toHaveLength(9);
    expect(f.at(-1)).toMatchObject({ matchId: "2782817800237", goals: 0, assists: 1, points: 1, outcome: "L", label: "Oct 22" });
    expect(f.some((x) => x.matchId.startsWith("summary"))).toBe(false);
  });
});

describe("heat", () => {
  it("ThePooker is hot (3.2 PPG last 5 vs 2.33 overall)", () => expect(heat(lines, games, "828785353")).toBe("hot"));
  it("players with fewer than 8 games get no label", () => expect(heat(lines, games, "1744375404")).toBeNull());
  it("cold when last 5 are well below average", () => {
    const base = lines.find((l) => l.eaPlayerId === "828785353")!;
    const synthetic: PlayerLine[] = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      eaPlayerId: "p",
      matchId: `c${i}`,
      goals: i < 5 ? 3 : 0, // first (oldest) 5 games hot, last 5 scoreless
      assists: 0,
    }));
    const g: GameLite[] = synthetic.map((l, i) => ({ ...games[0], matchId: l.matchId, playedAt: new Date(Date.UTC(2026, 9, 1 + i)) }));
    expect(heat(synthetic, g, "p")).toBe("cold");
  });
});

describe("divisionJourney", () => {
  const at = (d: string) => new Date(d);
  it("one run when the division never changed", () => {
    expect(divisionJourney([
      { takenAt: at("2026-10-23T10:00:00Z"), division: 8 },
      { takenAt: at("2026-10-23T11:00:00Z"), division: 8 },
      { takenAt: at("2026-10-24T11:00:00Z"), division: 8 },
    ])).toHaveLength(1);
  });
  it("splits on division changes, oldest first", () => {
    const j = divisionJourney([
      { takenAt: at("2026-10-25T10:00:00Z"), division: 8 },
      { takenAt: at("2026-10-20T10:00:00Z"), division: 9 },
    ]);
    expect(j.map((r) => r.division)).toEqual([9, 8]);
  });
  it("empty without snapshots", () => expect(divisionJourney([])).toEqual([]));
});

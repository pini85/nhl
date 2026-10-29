import { describe, expect, it } from "vitest";
import { groupGameNights } from "@/lib/stats/nights";
import { divisionJourney, heat, nightSeries, nightTeammates, playerForm } from "@/lib/stats/trends";
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
  it("adds the picked player's night totals; null when they sat out", () => {
    const nights = groupGameNights(games);
    const series = nightSeries(nights, 12, { lines, playerId: "828785353" });
    // Brute force from the raw lines, box-score games only.
    const expected = [...nights].reverse().map((n) => {
      const ids = new Set(n.games.filter((g) => g.source === "full").map((g) => g.matchId));
      const own = lines.filter((l) => l.eaPlayerId === "828785353" && ids.has(l.matchId));
      if (!own.length) return null;
      const goals = own.reduce((s, l) => s + l.goals, 0);
      const assists = own.reduce((s, l) => s + l.assists, 0);
      return { goals, assists, points: goals + assists };
    });
    expect(series.map((p) => p.me)).toEqual(expected);
    expect(series.some((p) => p.me && p.me.points > 0)).toBe(true);
    expect(nightSeries(nights, 12, { lines, playerId: "nobody" }).every((p) => p.me === null)).toBe(true);
    expect(nightSeries(nights).every((p) => p.me === undefined && p.mates === undefined && p.boxScore === undefined)).toBe(true);
  });
});

describe("nightSeries you vs teammates", () => {
  const base = lines.find((l) => l.position !== "goalie")!;
  const g1 = { ...games[0], matchId: "m1", source: "full" as const, playedAt: new Date(Date.UTC(2026, 9, 1, 19)) };
  const g2 = { ...g1, matchId: "m2", playedAt: new Date(Date.UTC(2026, 9, 1, 20)) };
  const line = (matchId: string, id: string, goals: number, assists: number, position = "center") => ({
    ...base,
    matchId,
    eaPlayerId: id,
    goals,
    assists,
    position,
  });
  const night = (ls: PlayerLine[], gs: GameLite[] = [g1, g2]) => nightSeries(groupGameNights(gs), 12, { lines: ls, playerId: "me" })[0];

  it("sums me over the night and averages each teammate's night total (goalies left out)", () => {
    const p = night([
      line("m1", "me", 2, 1),
      line("m2", "me", 1, 3), // me: 3G 4A 7P
      line("m1", "a", 1, 0),
      line("m2", "a", 0, 2), // a: 1G 2A 3P
      line("m1", "b", 2, 2), // b (one game): 2G 2A 4P
      line("m1", "g", 0, 5, "goalie"),
    ]);
    expect(p.boxScore).toBe(true);
    expect(p.me).toEqual({ goals: 3, assists: 4, points: 7 });
    expect(p.mates?.all).toEqual({ goals: 1.5, assists: 2, points: 3.5 });
  });
  it("rounds averages to one decimal", () => {
    const p = night([line("m1", "me", 0, 0), line("m1", "a", 1, 1), line("m1", "b", 0, 0), line("m1", "c", 0, 1)]);
    expect(p.mates?.all).toEqual({ goals: 0.3, assists: 0.7, points: 1 });
  });
  it("splits teammates into forwards and defense by the position they played each game", () => {
    const p = night([
      line("m1", "me", 1, 0, "leftWing"),
      line("m1", "c", 2, 1, "center"), // forward: 2G 1A
      line("m1", "rw", 0, 1, "rightWing"), // forward: 0G 1A
      line("m1", "d1", 0, 2, "defenseMen"), // defense: 0G 2A
      line("m1", "x", 1, 0, "center"),
      line("m2", "x", 0, 3, "defenseMen"), // x: forward 1G 0A in m1, defense 0G 3A in m2
      line("m1", "g", 0, 1, "goalie"),
    ]);
    expect(p.mates?.forwards).toEqual({ goals: 1, assists: 0.7, points: 1.7 }); // (2+0+1)/3, (1+1+0)/3, (3+1+1)/3
    expect(p.mates?.defense).toEqual({ goals: 0, assists: 2.5, points: 2.5 }); // d1 2A, x 3A
    expect(p.mates?.all).toEqual({ goals: 0.8, assists: 1.8, points: 2.5 }); // c 3P, rw 1P, d1 2P, x 4P over 4
  });
  it("keeps each teammate's own night totals for picking one player", () => {
    const p = night([
      line("m1", "me", 1, 0, "leftWing"),
      line("m1", "kai", 2, 1, "rightWing"),
      line("m2", "kai", 1, 0, "defenseMen"), // any position counts toward kai's own total
      line("m1", "g", 0, 1, "goalie"),
    ]);
    expect(p.others).toEqual({ kai: { goals: 3, assists: 1, points: 4 } });
    expect(p.roles).toEqual({ kai: "forwards" }); // 1 game at RW, 1 at D: tie goes to forwards
  });
  it("gives each teammate their role for that night", () => {
    const p = night([line("m1", "dan", 0, 0, "defenseMen"), line("m2", "dan", 0, 0, "defenseMen"), line("m1", "sam", 0, 0, "center")]);
    expect(p.roles).toEqual({ dan: "defense", sam: "forwards" });
  });
  it("lists teammates by games played, with their main role", () => {
    const ls = [
      line("m1", "me", 1, 0, "leftWing"),
      line("m1", "kai", 0, 0, "rightWing"),
      line("m2", "kai", 0, 0, "rightWing"),
      line("m1", "dan", 0, 0, "defenseMen"),
      line("m2", "dan", 0, 0, "defenseMen"),
      line("m2", "sam", 0, 0, "center"),
      line("m1", "g", 0, 0, "goalie"),
    ].map((l) => ({ ...l, playerName: l.eaPlayerId.toUpperCase() }));
    expect(nightTeammates(groupGameNights([g1, g2]), ls, "me")).toEqual([
      { id: "dan", name: "DAN", role: "defense", games: 2 },
      { id: "kai", name: "KAI", role: "forwards", games: 2 },
      { id: "sam", name: "SAM", role: "forwards", games: 1 },
    ]);
  });
  it("a night of score-only games is 'no box score', not 'didn't play'", () => {
    const p = night([], [{ ...g1, source: "summary" as const }]);
    expect(p).toMatchObject({ boxScore: false, me: null, mates: { all: null, forwards: null, defense: null } });
  });
  it("ignores lines from score-only games mixed into a night", () => {
    const p = night([line("m1", "me", 1, 1), line("m2", "me", 5, 5)], [g1, { ...g2, source: "summary" as const }]);
    expect(p.me).toEqual({ goals: 1, assists: 1, points: 2 });
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
  it("a player who never scores is not cold", () => {
    const base = lines.find((l) => l.eaPlayerId === "828785353")!;
    const zero: PlayerLine[] = Array.from({ length: 9 }, (_, i) => ({ ...base, eaPlayerId: "z", matchId: `z${i}`, goals: 0, assists: 0 }));
    const g: GameLite[] = zero.map((l, i) => ({ ...games[0], matchId: l.matchId, playedAt: new Date(Date.UTC(2026, 9, 1 + i)) }));
    expect(heat(zero, g, "z")).toBeNull();
  });

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

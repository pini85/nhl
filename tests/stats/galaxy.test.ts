import { describe, expect, it } from "vitest";
import type { RosterMember } from "@/lib/ea/normalize";
import { galaxyData } from "@/lib/stats/galaxy";
import { CLUB, game, line } from "../helpers/builders";
import { games, lines } from "../helpers/club-fixtures";

describe("galaxyData (real fixture)", () => {
  const roster = ["PePezki_", "Kai_Fretwell18"].map((name) => ({ name }) as RosterMember);
  const data = galaxyData(lines, games, roster, CLUB);

  it("includes roster members even when the game marked them as guests", () => {
    expect(data.players.map((p) => p.name)).toEqual(expect.arrayContaining(["PePezki_", "Kai_Fretwell18", "ThePooker"]));
    expect(data.players.map((p) => p.name)).not.toContain("val_kaz");
  });

  it("keeps every game, oldest first", () => {
    expect(data.games).toHaveLength(games.length);
    for (let i = 1; i < data.games.length; i++) expect(data.games[i].t).toBeGreaterThanOrEqual(data.games[i - 1].t);
  });

  it("matches the chemistry numbers for the main D-pair", () => {
    const id = (name: string) => data.players.find((p) => p.name === name)!.id;
    const [a, b] = [id("mike_v_75"), id("PePezki_")].sort();
    expect(data.links.find((l) => l.a === a && l.b === b)).toMatchObject({ gp: 6, wins: 4 });
  });

  it("only links players in the list, each pair once", () => {
    const ids = new Set(data.players.map((p) => p.id));
    const keys = data.links.map((l) => `${l.a}|${l.b}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of data.links) {
      expect(ids.has(l.a) && ids.has(l.b)).toBe(true);
      expect(l.a < l.b).toBe(true);
      expect(l.gp).toBeGreaterThanOrEqual(2);
    }
  });

  it("points are goals plus assists", () => {
    for (const p of data.players) expect(p.points).toBe(p.goals + p.assists);
  });
});

describe("galaxyData (hand-built)", () => {
  const g = [
    game("2", "2026-10-21T20:00:00Z", { outcome: "W", goalsFor: 4, goalsAgainst: 1, opponentName: "B" }),
    game("1", "2026-10-20T20:00:00Z", { outcome: "L", overtime: true }),
    game("3", "2026-10-22T20:00:00Z", { outcome: "W", source: "summary" }),
  ];
  const l = [
    line("1", "10", "Ana", { goals: 1 }),
    line("1", "20", "Ben", { position: "defenseMen", assists: 1 }),
    line("1", "30", "Cat", { position: "goalie" }),
    line("1", "99", "Guesty", { isGuest: true }),
    line("2", "10", "Ana", { goals: 2, assists: 1 }),
    line("2", "20", "Ben", { position: "defenseMen" }),
    line("2", "30", "Cat", { position: "goalie" }),
    line("2", "99", "Guesty", { isGuest: true }),
    line("3", "10", "Ana"),
  ];
  const data = galaxyData(l, g, null, CLUB);

  it("maps games", () => {
    expect(data.games.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(data.games[0]).toMatchObject({ win: false, ot: true });
    expect(data.games[1]).toMatchObject({ gf: 4, ga: 1, win: true, opp: "B", who: [0, 1, 2] });
    expect(data.games[2].who).toEqual([0]);
  });

  it("drops guests and picks a main position", () => {
    expect(data.players.map((p) => [p.name, p.pos])).toEqual([
      ["Ana", "F"],
      ["Ben", "D"],
      ["Cat", "G"],
    ]);
    expect(data.players[0]).toMatchObject({ gp: 3, goals: 3, assists: 1, points: 4 });
  });

  it("counts full games together only", () => {
    expect(data.links).toContainEqual({ a: "10", b: "20", gp: 2, wins: 1 });
    expect(data.links).toHaveLength(3);
  });

  it("respects the limits", () => {
    expect(galaxyData(l, g, null, CLUB, [], { maxPlayers: 2 }).players).toHaveLength(2);
    expect(galaxyData(l, g, null, CLUB, [], { minTogether: 3 }).links).toHaveLength(0);
  });
});

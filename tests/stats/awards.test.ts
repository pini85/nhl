import { describe, expect, it } from "vitest";
import { allAwards, badgeCabinet, gameAwards, seasonDivisionFromMatch } from "@/lib/stats/awards";
import { games, lines, normalized } from "../helpers/club-fixtures";

const clubs = normalized.flatMap((n) => n.clubs);
const game = (id: string) => games.find((g) => g.matchId === id)!;
const awardsOf = (id: string) => gameAwards(lines.filter((l) => l.matchId === id), game(id), clubs.filter((c) => c.matchId === id), 56507);
const keysFor = (id: string, name: string) => awardsOf(id).filter((a) => a.name === name).map((a) => a.key).sort();

describe("seasonDivisionFromMatch", () => {
  it("match division is reversed (11 − season division)", () => {
    expect(seasonDivisionFromMatch(3)).toBe(8);
    expect(seasonDivisionFromMatch(10)).toBe(1);
  });
});

describe("gameAwards", () => {
  it("Pulp Odysseys win", () => {
    expect(keysFor("2696722690436", "ThePooker")).toEqual(["giantslayer", "hattrick", "sniper"]);
    expect(keysFor("2696722690436", "pushckin")).toEqual(["giantslayer", "playmaker"]);
    expect(keysFor("2696722690436", "CelesteSueco")).toEqual(["brickwall"]); // goalies don't get the team award
  });
  it("CSKA win", () => {
    expect(keysFor("2780666310166", "Kai_Fretwell18")).toEqual(["giantslayer", "hattrick", "pickpocket", "plus"]);
  });
  it("no giant slayer in a loss to a higher division", () => {
    expect(awardsOf("2782817800237").some((a) => a.key === "giantslayer")).toBe(false);
  });
  it("no giant slayer against an equal division", () => {
    expect(awardsOf("2782122360291").some((a) => a.key === "giantslayer")).toBe(false);
  });
  it("summary games give no awards", () => {
    const s = games.find((g) => g.source === "summary")!;
    expect(gameAwards([], s, [], 56507)).toEqual([]);
  });
});

describe("allAwards and badge cabinet", () => {
  const all = allAwards(lines, games, clubs, 56507);
  it("includes a night MVP per night with points", () => {
    expect(all.filter((a) => a.key === "nightmvp").map((a) => a.name).sort()).toEqual(["ThePooker", "puck_control"]);
  });
  it("counts badges for a player", () => {
    const cab = badgeCabinet(all, "828785353");
    expect(cab.find((b) => b.key === "hattrick")?.count).toBe(2);
  });
  it("goalie-only player gets goalie badges only", () => {
    const celeste = lines.find((l) => l.playerName === "CelesteSueco")!.eaPlayerId;
    expect(badgeCabinet(all, celeste).map((b) => b.key)).toEqual(["brickwall"]);
  });
});

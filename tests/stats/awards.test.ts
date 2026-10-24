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
    expect(keysFor("2696722690436", "ThePooker")).toEqual(["giantslayer", "hattrick", "powerplay", "sniper"]);
    expect(keysFor("2696722690436", "pushckin")).toEqual(["giantslayer", "playmaker", "shotblocker"]);
    expect(keysFor("2696722690436", "CelesteSueco")).toEqual(["brickwall"]); // goalies don't get the team award
  });
  it("CSKA win", () => {
    expect(keysFor("2780666310166", "Kai_Fretwell18")).toEqual(["giantslayer", "hattrick", "pickpocket", "plus", "powerplay"]);
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

describe("awards for passing, defense and special teams", () => {
  const id = "2696722690436";
  const base = { ...lines.find((l) => l.matchId === id && l.playerName === "ThePooker")!, eaPlayerId: "t", playerName: "Tester" };
  const quiet = { goals: 0, assists: 0, shots: 0, hits: 0, plusMinus: 0, takeaways: 0, interceptions: 0, blockedShots: 0, ppg: 0, shg: 0, pim: 0, passAttempts: 10, passes: 5 };
  const keysWith = (o: Partial<typeof base>) =>
    gameAwards([{ ...base, ...quiet, ...o }], { ...game(id), outcome: "L" }, [], 56507).map((a) => a.key);

  it("ball hawk: 3+ interceptions", () => {
    expect(keysWith({ interceptions: 3 })).toEqual(["ballhawk"]);
    expect(keysWith({ interceptions: 2 })).toEqual([]);
  });
  it("shot blocker: 2+ blocked shots", () => {
    expect(keysWith({ blockedShots: 2 })).toEqual(["shotblocker"]);
    expect(keysWith({ blockedShots: 1 })).toEqual([]);
  });
  it("tape to tape: 85%+ passing on 20+ attempts", () => {
    expect(keysWith({ passAttempts: 20, passes: 17 })).toEqual(["tapetotape"]);
    expect(keysWith({ passAttempts: 19, passes: 19 })).toEqual([]);
    expect(keysWith({ passAttempts: 20, passes: 16 })).toEqual([]);
  });
  it("power play and shorthanded goals", () => {
    expect(keysWith({ ppg: 1 })).toEqual(["powerplay"]);
    expect(keysWith({ shg: 1 })).toEqual(["shorthanded"]);
  });
  it("sin bin: 6+ penalty minutes", () => {
    expect(keysWith({ pim: 6 })).toEqual(["sinbin"]);
    expect(keysWith({ pim: 4 })).toEqual([]);
  });
});

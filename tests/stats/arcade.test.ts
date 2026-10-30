import { describe, expect, it } from "vitest";
import type { RosterMember } from "@/lib/ea/normalize";
import { abbreviation, arcadeData, rate } from "@/lib/stats/arcade";
import { CLUB, game, line } from "../helpers/builders";
import { games, lines } from "../helpers/club-fixtures";

describe("arcadeData (real fixture)", () => {
  const roster = ["PePezki_", "Kai_Fretwell18"].map((name) => ({ name }) as RosterMember);
  const ours = lines.filter((l) => l.clubId === CLUB);
  const data = arcadeData(ours, games, roster, CLUB, [], lines);

  it("rates our regulars between 62 and 97, no guests", () => {
    expect(data.skaters.length).toBeGreaterThanOrEqual(3);
    expect(data.skaters.map((s) => s.name)).not.toContain("val_kaz");
    for (const s of data.skaters) {
      for (const v of Object.values(s.r)) expect(v).toBeGreaterThanOrEqual(62), expect(v).toBeLessThanOrEqual(97);
      expect(s.ovr).toBe(Math.round((s.r.skate + s.r.shot + s.r.pass + s.r.hit) / 4));
    }
  });

  it("always has a goalie", () => {
    expect(data.goalies.length).toBeGreaterThan(0);
  });

  it("lists every club we played with real gamertags and three skaters", () => {
    const clubs = new Set(games.map((g) => g.opponentClubId));
    expect(data.opponents.map((o) => o.clubId).sort()).toEqual([...clubs].sort());
    const infernal = data.opponents.find((o) => o.name === "INFERNAL LEGION")!;
    expect(infernal.skaters).toHaveLength(3);
    expect(infernal.skaters.every((s) => !s.name.startsWith("IL #"))).toBe(true);
    const ourNames = new Set(ours.map((l) => l.playerName));
    for (const o of data.opponents) for (const s of o.skaters) expect(ourNames.has(s.name)).toBe(false);
  });

  it("the Revenge Tour holds exactly the clubs with a losing or even record against us, nemesis last", () => {
    const rev = data.opponents.filter((o) => o.losses >= o.wins).map((o) => o.clubId);
    expect([...data.tour].sort()).toEqual(rev.sort());
    const diffs = data.tour.map((id) => data.opponents.find((o) => o.clubId === id)!.difficulty);
    expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
  });

  it("clubs that beat us are harder than clubs we beat", () => {
    const beatUs = data.opponents.filter((o) => o.losses > o.wins);
    const weBeat = data.opponents.filter((o) => o.wins > o.losses);
    expect(Math.min(...beatUs.map((o) => o.difficulty))).toBeGreaterThan(Math.max(...weBeat.map((o) => o.difficulty)));
  });
});

describe("arcadeData (hand-built)", () => {
  const g = [
    game("1", "2026-10-20T20:00:00Z", { opponentClubId: 7, opponentName: "Night Owls", outcome: "L", goalsFor: 1, goalsAgainst: 6 }),
    game("2", "2026-10-21T20:00:00Z", { opponentClubId: 8, opponentName: null, outcome: "W", source: "summary" }),
  ];
  const ours = [
    line("1", "10", "Ana", { goals: 2, shots: 4 }),
    line("1", "20", "Ben", { position: "defenseMen", hits: 9 }),
    line("1", "30", "Cat", { position: "goalie", glSaves: 20, glShots: 26 }),
  ];
  const theirs = [line("1", "70", "Owl", { clubId: 7, goals: 3 }), line("1", "71", "Hoot", { clubId: 7, position: "goalie" })];
  const data = arcadeData(ours, g, null, CLUB, [], theirs);

  it("fills missing players with call-ups", () => {
    const owls = data.opponents.find((o) => o.clubId === 7)!;
    expect(owls.skaters.map((s) => s.name)).toEqual(["Owl", "NO #17", "NO #44"]);
    expect(owls.goalie.name).toBe("Hoot");
    const anon = data.opponents.find((o) => o.clubId === 8)!;
    expect(anon.name).toBe("Club 8");
    expect(anon.skaters).toHaveLength(3);
  });

  it("knows our positions and the real last result", () => {
    expect(data.skaters.find((s) => s.name === "Ben")?.pos).toBe("D");
    expect(data.goalies[0].name).toBe("Cat");
    expect(data.opponents.find((o) => o.clubId === 7)?.last).toMatchObject({ gf: 1, ga: 6, win: false });
    expect(data.tour).toEqual([7]);
  });
});

describe("helpers", () => {
  it("abbreviates club names", () => {
    expect(abbreviation("INFERNAL LEGION")).toBe("IL");
    expect(abbreviation("Sivudeke")).toBe("SIV");
    expect(abbreviation("HC Total Chaos")).toBe("HTC");
  });

  it("rates by rank and pulls tiny samples toward the middle", () => {
    expect(rate([{ v: 1, gp: 10 }, { v: 2, gp: 10 }, { v: 3, gp: 10 }])).toEqual([62, 80, 97]);
    const [a, b] = rate([{ v: 0, gp: 20 }, { v: 9, gp: 20 }, { v: 5, gp: 1 }]);
    expect(a).toBe(62);
    expect(b).toBe(97);
  });
});

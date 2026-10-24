import { describe, expect, it } from "vitest";
import { clubRecords, currentStreak, milestones } from "@/lib/stats/records";
import type { GameLite, PlayerLine } from "@/lib/stats/types";
import { games, lines } from "../helpers/club-fixtures";

const rec = (key: string) => clubRecords(lines, games, 56507).find((r) => r.key === key)!;

describe("clubRecords", () => {
  it("most goals by a player in a game", () => {
    expect(rec("goals-game")).toMatchObject({ value: 4, holder: "ThePooker", matchId: "2696722690436" });
  });
  it("most team goals in a game", () => expect(rec("team-goals-game")).toMatchObject({ value: 7, matchId: "2780666310166" }));
  it("biggest win", () => expect(rec("biggest-win")).toMatchObject({ value: 6, matchId: "2780666310166" }));
  it("longest win streak (chronological, includes score-only games)", () => expect(rec("win-streak").value).toBe(4));
  it("longest player point streak", () => expect(rec("point-streak")).toMatchObject({ value: 7, holder: "puck_control" }));
  it("ties go to the earliest", () => {
    const base = lines.find((l) => l.eaPlayerId === "828785353")!;
    const g1: GameLite = { ...games[0], matchId: "t1", playedAt: new Date("2026-09-01T19:00:00Z") };
    const g2: GameLite = { ...games[0], matchId: "t2", playedAt: new Date("2026-09-02T19:00:00Z") };
    const l: PlayerLine[] = [
      { ...base, matchId: "t2", eaPlayerId: "b", playerName: "Later", goals: 3 },
      { ...base, matchId: "t1", eaPlayerId: "a", playerName: "Earlier", goals: 3 },
    ];
    expect(clubRecords(l, [g1, g2], base.clubId).find((r) => r.key === "goals-game")?.holder).toBe("Earlier");
  });
  it("same-game ties break by name, not database order", () => {
    const base = lines.find((l) => l.eaPlayerId === "828785353")!;
    const g1: GameLite = { ...games[0], matchId: "t1", playedAt: new Date("2026-09-01T19:00:00Z") };
    const make = (id: string, name: string): PlayerLine => ({ ...base, matchId: "t1", eaPlayerId: id, playerName: name, goals: 3 });
    const one = clubRecords([make("2", "Zed"), make("1", "Amy")], [g1], base.clubId).find((r) => r.key === "goals-game")?.holder;
    const two = clubRecords([make("1", "Amy"), make("2", "Zed")], [g1], base.clubId).find((r) => r.key === "goals-game")?.holder;
    expect([one, two]).toEqual(["Amy", "Amy"]);
  });
  it("defense and passing records", () => {
    expect(rec("takeaways-game").value).toBeGreaterThan(0);
    expect(rec("interceptions-game").value).toBeGreaterThan(0);
    expect(rec("blocks-game").value).toBeGreaterThan(0);
  });
  it("best passing game needs 20+ attempts", () => {
    const top = Math.max(...lines.filter((l) => l.clubId === 56507 && l.passAttempts >= 20).map((l) => Math.round((l.passes / l.passAttempts) * 100)));
    expect(rec("pass-pct-game").value).toBe(top);
  });
  it("records carry the holder's player id", () => {
    expect(rec("point-streak")).toMatchObject({ holder: "puck_control", holderId: "1273735466" });
    expect(rec("goals-game").holderId).toBe(lines.find((l) => l.playerName === "ThePooker")!.eaPlayerId);
    expect(rec("team-goals-game").holderId).toBeNull();
  });
  it("no records without games", () => expect(clubRecords([], [], 56507)).toEqual([]));
});

describe("currentStreak", () => {
  it("newest run", () => expect(currentStreak(games)).toEqual({ kind: "L", length: 1 }));
  it("null without games", () => expect(currentStreak([])).toBeNull());
});

describe("milestones", () => {
  const m = milestones(lines, games, 56507);
  it("club goals 10", () => expect(m.find((x) => x.label === "Club goals: 10")).toMatchObject({ matchId: "2782122360291", holder: null }));
  it("club points 10", () => expect(m.find((x) => x.label === "Club points: 10")?.matchId).toBe("2696722690436"));
  it("first hat trick", () => expect(m.find((x) => x.label === "First hat trick")).toMatchObject({ matchId: "2696722690436", holder: "ThePooker" }));
  it("milestones carry the holder's id", () => {
    expect(m.find((x) => x.label === "First hat trick")!.holderId).toBe(lines.find((l) => l.playerName === "ThePooker")!.eaPlayerId);
    expect(m.find((x) => x.label === "Club goals: 10")!.holderId).toBeNull();
  });
});

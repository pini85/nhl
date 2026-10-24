import { describe, expect, it } from "vitest";
import { activeMoments, isAboutMe, type Moment, type MomentInput, momentHref, moments, momentText } from "@/lib/stats/moments";
import type { ExtraStats, GameLite, PlayerLine } from "@/lib/stats/types";
import { CLUB, game, line, SINCE } from "../helpers/builders";
import { games as fixtureGames, lines as fixtureLines } from "../helpers/club-fixtures";

const input = (games: GameLite[], lines: PlayerLine[], extra: Partial<MomentInput> = {}): MomentInput => ({
  games,
  lines,
  clubs: [],
  extras: [],
  history: [],
  ourClubId: CLUB,
  ...extra,
});

const ofKey = (ms: Moment[], key: string) => ms.filter((m) => m.key === key);

describe("record moments", () => {
  it("beating an existing record makes one moment with the previous holder", () => {
    const g = [game("t1", "2026-10-01T19:00:00Z"), game("t2", "2026-10-12T19:00:00Z")];
    const l = [line("t1", "a", "Amy", { hits: 5 }), line("t2", "b", "Bob", { hits: 7 })];
    const hits = ofKey(moments(input(g, l), SINCE), "hits-game");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "record", playerId: "b", playerName: "Bob", prevHolderId: "a", prevHolderName: "Amy", value: 7, matchId: "t2" });
  });

  it("first time a record exists makes no moment", () => {
    const g = [game("t2", "2026-10-12T19:00:00Z")];
    const l = [line("t2", "b", "Bob", { hits: 7, goals: 2 })];
    expect(moments(input(g, l), SINCE).filter((m) => m.kind === "record")).toEqual([]);
  });

  it("a record extended over several games makes one moment, keeping the original previous holder", () => {
    const g = [game("t1", "2026-10-01T19:00:00Z"), game("t2", "2026-10-12T19:00:00Z"), game("t3", "2026-10-13T19:00:00Z")];
    const l = [line("t1", "a", "Amy", { hits: 5 }), line("t2", "b", "Bob", { hits: 7 }), line("t3", "b", "Bob", { hits: 9 })];
    const hits = ofKey(moments(input(g, l), SINCE), "hits-game");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ value: 9, matchId: "t3", prevHolderId: "a" });
  });

  it("team records have no player", () => {
    const g = [game("t1", "2026-10-01T19:00:00Z", { goalsFor: 3 }), game("t2", "2026-10-12T19:00:00Z", { goalsFor: 6 })];
    const team = ofKey(moments(input(g, []), SINCE), "team-goals-game");
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ kind: "record", playerId: null, value: 6 });
  });
});

describe("award moments", () => {
  it("only hat tricks, shutouts and Night MVP count as award moments", () => {
    const g = [game("t2", "2026-10-12T19:00:00Z", { outcome: "W", goalsFor: 3 })];
    const sniperBruiser = line("t2", "b", "Bob", { goals: 2, shots: 2, hits: 6 });
    const awards = moments(input(g, [sniperBruiser]), SINCE).filter((m) => m.kind === "award");
    expect(awards.map((a) => a.key)).toEqual(["nightmvp"]);
  });

  it("a hat trick is an award moment linked to its game", () => {
    const g = [game("t2", "2026-10-12T19:00:00Z")];
    const hat = ofKey(moments(input(g, [line("t2", "b", "Bob", { goals: 3 })]), SINCE), "hattrick");
    expect(hat).toHaveLength(1);
    expect(hat[0]).toMatchObject({ playerId: "b", matchId: "t2", emoji: "🎩", label: "Hat trick", where: "vs Opp" });
    expect(momentHref(hat[0])).toBe("/games/t2");
  });

  it("Night MVP links to the night and is timed at its last game", () => {
    const g = [game("t2", "2026-10-12T19:00:00Z"), game("t3", "2026-10-12T19:40:00Z")];
    const mvp = ofKey(moments(input(g, [line("t2", "b", "Bob", { goals: 1 })]), SINCE), "nightmvp")[0];
    expect(mvp.nightKey).toBe("2026-10-12");
    expect(mvp.where).toBe("on Mon Oct 12");
    expect(mvp.at).toEqual(new Date("2026-10-12T19:40:00Z"));
    expect(momentHref(mvp)).toBe("/nights/2026-10-12");
  });
});

describe("milestone moments", () => {
  it("milestones start from stats of games without a box score", () => {
    const extras: ExtraStats[] = [
      { eaPlayerId: "b", playerName: "Bob", coversFrom: new Date("2026-09-01"), gp: 3, goals: 8, assists: 0, plusMinus: 0, shots: 0, hits: 0, pim: 0, ppg: 0, shg: 0, takeaways: 0, giveaways: 0, blockedShots: 0, interceptions: 0, passAttempts: 0, passes: 0 },
    ];
    const g = [game("t2", "2026-10-12T19:00:00Z")];
    const ms = moments(input(g, [line("t2", "b", "Bob", { goals: 2 })], { extras }), SINCE).filter((m) => m.kind === "milestone");
    expect(ms.find((m) => m.key === "goals")).toMatchObject({ playerId: "b", value: 10, label: "10th goal" });
    expect(ms.find((m) => m.key === "points")).toMatchObject({ value: 10, label: "10th point" });
  });

  it("club milestones from 100 up are team moments; smaller ones are left out", () => {
    const g = [game("t1", "2026-10-01T19:00:00Z"), game("t2", "2026-10-12T19:00:00Z"), game("t3", "2026-10-13T19:00:00Z")];
    const l = [line("t1", "a", "Amy", { goals: 5 }), line("t2", "a", "Amy", { goals: 20 }), line("t3", "a", "Amy", { goals: 80 })];
    const labels = moments(input(g, l), SINCE).filter((m) => m.kind === "team").map((m) => m.label);
    expect(labels).toContain("Club goals: 100");
    expect(labels).not.toContain("Club goals: 25");
  });
});

describe("team moments", () => {
  it("promotion becomes a team moment", () => {
    const history = [
      { takenAt: new Date("2026-10-01T00:00:00Z"), division: 8 },
      { takenAt: new Date("2026-10-15T00:00:00Z"), division: 7 },
    ];
    const promo = moments(input([], [], { history }), SINCE).filter((m) => m.key === "promotion");
    expect(promo).toHaveLength(1);
    expect(promo[0]).toMatchObject({ kind: "team", label: "Promoted to Division 7", emoji: "⬆️", playerId: null });
  });
});

describe("ids, window and order", () => {
  const g = [game("t1", "2026-10-01T19:00:00Z"), game("t2", "2026-10-12T19:00:00Z")];
  const l = [line("t1", "a", "Amy", { goals: 3 }), line("t2", "b", "Bob", { goals: 3 }), line("t2", "c", "Cid", { goals: 3 })];

  it("ids are stable across calls and differ per player", () => {
    const one = ofKey(moments(input(g, l), SINCE), "hattrick");
    const two = ofKey(moments(input(g, l), SINCE), "hattrick");
    expect(one.map((m) => m.id)).toEqual(two.map((m) => m.id));
    expect(new Set(one.map((m) => m.id)).size).toBe(2);
    for (const m of one) expect(m.id).toMatch(/^[a-z0-9]{1,12}$/);
  });

  it("nothing before since", () => {
    expect(moments(input(g, l), SINCE).some((m) => m.at < SINCE)).toBe(false);
  });

  it("newest first", () => {
    const ats = moments(input(g, l), new Date(0)).map((m) => m.at.getTime());
    expect(ats).toEqual([...ats].sort((a, b) => b - a));
  });

  it("activeMoments covers the last 14 days", () => {
    const now = new Date("2026-10-27T19:00:00Z");
    expect(activeMoments(input(g, l), now).every((m) => m.at >= new Date("2026-10-13T19:00:00Z"))).toBe(true);
    expect(activeMoments(input(g, l), new Date("2026-10-20T00:00:00Z")).length).toBeGreaterThan(0);
  });

  it("runs fast on the real fixtures", () => {
    const t = performance.now();
    moments(input(fixtureGames, fixtureLines), new Date(0));
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("momentText", () => {
  const rec: Moment = {
    id: "x1",
    kind: "record",
    at: new Date("2026-10-12T19:00:00Z"),
    emoji: "🏆",
    key: "hits-game",
    value: 15,
    label: "hits",
    playerId: "b",
    playerName: "R4D1M_19",
    prevHolderId: "a",
    prevHolderName: "puck_control",
    matchId: "t2",
    nightKey: null,
    where: "vs HK Bricks",
  };

  it("words a record for the new holder, the previous holder and everyone", () => {
    expect(momentText(rec, "b")).toBe("🏆 You set a club record: 15 hits in a game vs HK Bricks");
    expect(momentText(rec, "a")).toBe("😤 R4D1M_19 took your hits record (15)");
    expect(momentText(rec, null)).toBe("🏆 R4D1M_19 set a club record: 15 hits in a game vs HK Bricks (was puck_control's)");
    expect(isAboutMe(rec, "a")).toBe(true);
    expect(isAboutMe(rec, "b")).toBe(true);
    expect(isAboutMe(rec, "z")).toBe(false);
  });

  it("words beating your own record", () => {
    const own = { ...rec, prevHolderId: "b", prevHolderName: "R4D1M_19" };
    expect(momentText(own, "b")).toBe("🏆 You beat your own club record: 15 hits in a game vs HK Bricks");
    expect(momentText(own, null)).toBe("🏆 R4D1M_19 beat their own club record: 15 hits in a game vs HK Bricks");
  });

  it("words streak records with a hyphen", () => {
    const streak = { ...rec, key: "point-streak", label: "point streak", value: 8, where: null };
    expect(momentText(streak, "b")).toBe("🏆 You set a club record: 8-game point streak");
  });

  it("words team records, awards, milestones and team moments", () => {
    expect(momentText({ ...rec, key: "win-streak", label: "wins in a row", value: 6, playerId: null, playerName: null, prevHolderId: null, prevHolderName: null, where: null }, null)).toBe(
      "🔥 Team record: 6 wins in a row",
    );
    const award: Moment = { ...rec, kind: "award", key: "hattrick", emoji: "🎩", label: "Hat trick", value: null, prevHolderId: null, prevHolderName: null };
    expect(momentText(award, "b")).toBe("🎩 Your hat trick vs HK Bricks");
    expect(momentText(award, null)).toBe("🎩 Hat trick for R4D1M_19 vs HK Bricks");
    const mvp: Moment = { ...award, key: "nightmvp", emoji: "⭐", label: "Night MVP", matchId: null, nightKey: "2026-10-12", where: "on Mon Oct 12" };
    expect(momentText(mvp, "b")).toBe("⭐ You were Night MVP on Mon Oct 12");
    expect(momentText(mvp, null)).toBe("⭐ Night MVP on Mon Oct 12: R4D1M_19");
    const ms: Moment = { ...award, kind: "milestone", key: "points", emoji: "💯", label: "100th point", value: 100 };
    expect(momentText(ms, "b")).toBe("💯 Your 100th point, vs HK Bricks");
    expect(momentText(ms, null)).toBe("💯 100th point for R4D1M_19, vs HK Bricks");
    const team: Moment = { ...award, kind: "team", key: "promotion", emoji: "⬆️", label: "Promoted to Division 7", playerId: null, playerName: null, where: null };
    expect(momentText(team, "b")).toBe("⬆️ Promoted to Division 7");
  });
});

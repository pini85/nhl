import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeResult, normalizeMatch, parseRecentResults, toInt, toNum } from "@/lib/ea/normalize";
import { EaMatchListSchema, EaSeasonalStatsListSchema, type EaSeasonalStats } from "@/lib/ea/schemas";

const FIX = "tests/fixtures/ea/2026-10-23";
const ms = EaMatchListSchema.parse(JSON.parse(readFileSync(`${FIX}/matches-gameType5.json`, "utf8")));
const seasonal = EaSeasonalStatsListSchema.parse(
  JSON.parse(readFileSync(`${FIX}/seasonal-stats.json`, "utf8")),
)[0] as EaSeasonalStats;

describe("decodeResult", () => {
  it.each([
    ["1", 6, 5, { outcome: "W", overtime: false, dnf: "none" }],
    ["2", 2, 4, { outcome: "L", overtime: false, dnf: "none" }],
    ["5", 3, 2, { outcome: "W", overtime: true, dnf: "none" }],
    ["6", 2, 3, { outcome: "L", overtime: true, dnf: "none" }],
    ["16385", 7, 1, { outcome: "W", overtime: false, dnf: "opponent_quit" }],
    ["10", 1, 7, { outcome: "L", overtime: false, dnf: "we_quit" }],
    ["3", 4, 1, { outcome: "W", overtime: false, dnf: "none" }], // unknown code: from score
    ["16386", 0, 2, { outcome: "L", overtime: false, dnf: "none" }],
  ] as const)("decodeResult(%s)", (code, gf, ga, expected) => {
    expect(decodeResult(code, gf, ga)).toEqual(expected);
  });
});

describe("number coercion", () => {
  it("coerces EA numeric strings", () => {
    expect([toInt(""), toInt(undefined), toInt("65.00"), toInt("abc"), toNum("65.50"), toNum(null)]).toEqual([
      0, 0, 65, 0, 65.5, 0,
    ]);
  });
});

describe("normalizeMatch", () => {
  it("normalizes the INFERNAL LEGION loss", () => {
    const n = normalizeMatch(ms[0], "gameType5", 56507);
    expect(n.match).toMatchObject({
      matchId: "2782817800237",
      opponentClubId: 1808,
      goalsFor: 2,
      goalsAgainst: 4,
      outcome: "L",
      overtime: false,
      dnf: "none",
      resultCode: "2",
      source: "full",
      matchType: "gameType5",
      timestampEstimated: false,
    });
    expect(n.match.playedAt).toEqual(new Date(1792705388 * 1000));
    expect(n.clubs.find((c) => c.clubId === 56507)).toMatchObject({
      shots: 14,
      hits: 21,
      pim: 12,
      faceoffWins: 13,
      faceoffLosses: 13,
      name: "Drop drop drop",
      crestAssetId: "104",
    });
    expect(n.players).toHaveLength(12);
    expect(n.players.find((p) => p.eaPlayerId === "1982691766")).toMatchObject({
      playerName: "turunen73",
      position: "goalie",
      isGuest: true,
      glSaves: 22,
      clubId: 56507,
      matchId: "2782817800237",
    });
    expect(n.players.find((p) => p.eaPlayerId === "1006205034907")?.clubId).toBe(1808);
  });

  it("decodes an opponent-quit win", () => {
    const n = normalizeMatch(ms[1], "gameType5", 56507);
    expect(n.match).toMatchObject({ goalsFor: 7, goalsAgainst: 1, outcome: "W", dnf: "opponent_quit" });
  });

  it("stores a match with no player rows when a club's players are missing", () => {
    const m = structuredClone(ms[0]);
    delete m.players["1808"];
    const n = normalizeMatch(m, "gameType5", 56507);
    expect(n.players.filter((p) => p.clubId === 1808)).toHaveLength(0);
    expect(n.players).toHaveLength(6);
    expect(n.clubs).toHaveLength(2);
  });

  it("throws when our club is not in the match", () => {
    expect(() => normalizeMatch(ms[0], "gameType5", 999)).toThrow();
  });
});

describe("parseRecentResults", () => {
  it("parses recent results newest-first with opponent-first scores", () => {
    const r = parseRecentResults(seasonal);
    expect(r).toHaveLength(10);
    expect(r[0]).toEqual({ index: 0, opponentClubId: 1808, goalsFor: 2, goalsAgainst: 4, outcome: "L" });
    expect(r[6]).toEqual({ index: 6, opponentClubId: 1974, goalsFor: 3, goalsAgainst: 1, outcome: "W" });
  });

  it("skips empty entries", () => {
    const s = { ...seasonal, recentOpponent9: "0", recentScore8: "" } as EaSeasonalStats;
    expect(parseRecentResults(s).map((x) => x.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

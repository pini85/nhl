import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import {
  existingMatchIds,
  finishRun,
  insertNormalizedMatch,
  insertSnapshot,
  lastRunAt,
  newestStoredPlayedAt,
  recentStoredResults,
  startRun,
} from "@/db/repo";
import { clubSnapshots, matchClubs, matches, matchPlayers } from "@/db/schema";
import { normalizeMatch } from "@/lib/ea/normalize";
import { EaMatchListSchema } from "@/lib/ea/schemas";
import { createTestDb } from "../helpers/db";

const ms = EaMatchListSchema.parse(
  JSON.parse(readFileSync("tests/fixtures/ea/2026-10-23/matches-gameType5.json", "utf8")),
);
const normalized = ms.map((m) => normalizeMatch(m, "gameType5", 56507));
const n0 = normalized[0];

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("insertNormalizedMatch", () => {
  it("inserts a normalized match once", async () => {
    expect(await insertNormalizedMatch(db, n0)).toBe(true);
    expect(await insertNormalizedMatch(db, n0)).toBe(false);
    expect(await db.select().from(matchPlayers)).toHaveLength(12);
    expect(await db.select().from(matchClubs)).toHaveLength(2);
  });

  it("handles concurrent inserts of the same match", async () => {
    const r = await Promise.all([insertNormalizedMatch(db, n0), insertNormalizedMatch(db, n0)]);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(await db.select().from(matches)).toHaveLength(1);
  });

  it("keeps raw payload and timestamp", async () => {
    await insertNormalizedMatch(db, n0);
    const [row] = await db.select().from(matches);
    expect(row.playedAt).toEqual(new Date(1792705388 * 1000));
    expect((row.raw as { matchId: string }).matchId).toBe("2782817800237");
  });
});

describe("queries", () => {
  it("returns existing ids", async () => {
    await insertNormalizedMatch(db, n0);
    expect(await existingMatchIds(db, ["2782817800237", "x"])).toEqual(new Set(["2782817800237"]));
    expect(await existingMatchIds(db, [])).toEqual(new Set());
  });

  it("lists recent results newest first", async () => {
    for (const n of [...normalized].reverse()) await insertNormalizedMatch(db, n);
    const r = await recentStoredResults(db, 30);
    expect(r).toHaveLength(5);
    expect(r[0]).toMatchObject({ matchId: "2782817800237", opponentClubId: 1808, goalsFor: 2, goalsAgainst: 4, source: "full" });
    expect(await recentStoredResults(db, 2)).toHaveLength(2);
  });

  it("returns the newest stored playedAt or null", async () => {
    expect(await newestStoredPlayedAt(db)).toBeNull();
    await insertNormalizedMatch(db, normalized[2]);
    await insertNormalizedMatch(db, n0);
    expect(await newestStoredPlayedAt(db)).toEqual(new Date(1792705388 * 1000));
  });
});

describe("snapshots and runs", () => {
  it("stores a snapshot", async () => {
    await insertSnapshot(db, {
      takenAt: new Date(),
      clubId: 56507,
      division: 8,
      seasonResults: ["losses", "wins"],
      recentResults: [{ index: 0, opponentClubId: 1808, goalsFor: 2, goalsAgainst: 4, outcome: "L" }],
      wins: 11,
      losses: 9,
      otl: 0,
      titles: 1,
      promotions: 2,
      holds: 0,
      relegations: 0,
      rankingPoints: 76,
      seasons: 2,
      raw: {},
    });
    const [s] = await db.select().from(clubSnapshots);
    expect(s).toMatchObject({ division: 8, promotions: 2 });
    expect(s.recentResults[0].opponentClubId).toBe(1808);
  });

  it("records runs", async () => {
    const stuck = await startRun(db, "cron");
    expect(await lastRunAt(db, "ok")).toBeNull();
    expect(await lastRunAt(db)).toBeInstanceOf(Date);
    const id = await startRun(db, "manual");
    expect(id).not.toBe(stuck);
    await finishRun(db, id, { status: "ok", newMatches: 1, recoveredMatches: 0, summaryMatches: 0, warnings: [] });
    expect(await lastRunAt(db, "ok")).toBeInstanceOf(Date);
  });
});

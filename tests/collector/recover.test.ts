import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { insertMatchRow } from "@/db/repo";
import { matches } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { findUncovered } from "@/lib/collector/recover";
import type { EaApi } from "@/lib/ea/api";
import type { RecentResult } from "@/lib/ea/normalize";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const fixtureEa = createFixtureEa("tests/fixtures/ea/2026-10-23");
const now = () => new Date("2026-10-23T12:00:00Z");
const r = (index: number, opponentClubId: number, goalsFor: number, goalsAgainst: number): RecentResult => ({
  index,
  opponentClubId,
  goalsFor,
  goalsAgainst,
  outcome: goalsFor > goalsAgainst ? "W" : "L",
});

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("findUncovered", () => {
  it("matches as a multiset by opponent+score, oldest entries uncovered first", () => {
    const recent = [r(0, 1, 2, 1), r(1, 1, 2, 1), r(2, 5, 0, 3)];
    const stored = [{ opponentClubId: 1, goalsFor: 2, goalsAgainst: 1 }];
    expect(findUncovered(recent, stored).map((x) => x.index)).toEqual([1, 2]);
  });

  it("returns nothing when all are covered", () => {
    expect(findUncovered([r(0, 1, 2, 1)], [{ opponentClubId: 1, goalsFor: 2, goalsAgainst: 1 }])).toEqual([]);
  });
});

describe("recovery during collect", () => {
  it("first run with fixtures recovers 4 games and adds 1 summary", async () => {
    const s = await collect({ db, ea: fixtureEa, now }, "seed");
    expect(s).toMatchObject({ status: "ok", newMatches: 5, recoveredMatches: 4, summaryMatches: 1 });
    expect(s.warnings).toEqual(["summary-only:1"]);
    const rows = await db.select().from(matches);
    expect(rows).toHaveLength(10);
    const summary = rows.find((m) => m.source === "summary")!;
    expect(summary).toMatchObject({
      opponentClubId: 1974,
      goalsFor: 3,
      goalsAgainst: 1,
      outcome: "W",
      timestampEstimated: true,
      raw: null,
    });
    const ssk = rows.find((m) => m.matchId === "2776830620072")!; // SSK Prospects, the newer neighbour
    expect(summary.playedAt.getTime()).toBe(ssk.playedAt.getTime() - 1000);
  });

  it("second run adds nothing", async () => {
    await collect({ db, ea: fixtureEa, now }, "seed");
    const s = await collect({ db, ea: fixtureEa, now }, "cron");
    expect(s).toMatchObject({ newMatches: 0, recoveredMatches: 0, summaryMatches: 0 });
    expect(await db.select().from(matches)).toHaveLength(10);
  });

  it("does not recover when not asked to", async () => {
    const s = await collect({ db, ea: fixtureEa, now }, "seed", { recover: false });
    expect(s.recoveredMatches).toBe(0);
  });

  it("opponent EA failure becomes a warning", async () => {
    const ea: EaApi = {
      clubMatches: (id, type) =>
        id === 56507
          ? fixtureEa.clubMatches(id, type)
          : Promise.resolve({ ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } }),
      seasonalStats: fixtureEa.seasonalStats,
    };
    const s = await collect({ db, ea, now }, "seed");
    expect(s.status).toBe("ok");
    expect(s.warnings).toContain("recover-failed:1616");
    expect(s.summaryMatches).toBe(0); // failed opponents stay pending, no score-only rows
  });

  it("retries a failed opponent fetch on the next run", async () => {
    let opponentsDown = true;
    const ea: EaApi = {
      clubMatches: (id, type) =>
        id !== 56507 && opponentsDown
          ? Promise.resolve({ ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } })
          : fixtureEa.clubMatches(id, type),
      seasonalStats: fixtureEa.seasonalStats,
    };
    await collect({ db, ea, now }, "seed");
    opponentsDown = false;
    const s = await collect({ db, ea, now }, "cron");
    expect(s).toMatchObject({ recoveredMatches: 4, summaryMatches: 1 });
    expect(await db.select().from(matches)).toHaveLength(10);
  });

  it("recovers on a later run when seasonalStats failed during the gap run", async () => {
    let seasonalDown = true;
    const ea: EaApi = {
      clubMatches: fixtureEa.clubMatches,
      seasonalStats: () =>
        seasonalDown
          ? Promise.resolve({ ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } })
          : fixtureEa.seasonalStats(56507),
    };
    const first = await collect({ db, ea, now }, "cron");
    expect(first.recoveredMatches).toBe(0);
    seasonalDown = false;
    const second = await collect({ db, ea, now }, "cron");
    expect(second).toMatchObject({ newMatches: 0, recoveredMatches: 4, summaryMatches: 1 });
  });

  it("recovers when seeding a database that already has newer games", async () => {
    await insertMatchRow(db, row("live-1", "2026-10-25T20:00:00Z", 999, 4, 0, "gameType5"));
    const s = await collect({ db, ea: fixtureEa, now }, "seed");
    expect(s).toMatchObject({ newMatches: 5, recoveredMatches: 4, summaryMatches: 1 });
  });

  it("does not let a private game cover a season result", async () => {
    // Same opponent and score as the 1974 season game, but a private match.
    await insertMatchRow(db, row("private-1", "2026-10-22T18:00:00Z", 1974, 3, 1, "club_private"));
    const s = await collect({ db, ea: fixtureEa, now }, "seed");
    expect(s.summaryMatches).toBe(1);
  });

  it("never writes a score-only row for a game still in our own last 5", async () => {
    // Our own list fails, so the 5 newest results are uncovered but must stay pending.
    const ea: EaApi = {
      clubMatches: (id, type) =>
        id === 56507
          ? Promise.resolve({ ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } })
          : fixtureEa.clubMatches(id, type),
      seasonalStats: fixtureEa.seasonalStats,
    };
    const s = await collect({ db, ea, now }, "cron");
    const rows = await db.select().from(matches);
    expect(rows.filter((m) => m.source === "summary").map((m) => m.opponentClubId)).toEqual([1974]);
    expect(s.recoveredMatches).toBe(4);
  });
});

function row(matchId: string, at: string, opp: number, gf: number, ga: number, matchType: string) {
  return {
    matchId,
    playedAt: new Date(at),
    matchType,
    source: "full" as const,
    opponentClubId: opp,
    goalsFor: gf,
    goalsAgainst: ga,
    outcome: (gf > ga ? "W" : "L") as "W" | "L",
    overtime: false,
    dnf: "none" as const,
    resultCode: null,
    timestampEstimated: false,
    raw: null,
  };
}

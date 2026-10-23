import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
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
    expect(s.summaryMatches).toBe(5); // nothing recovered, so all 5 older games are score-only
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { insertMatchRow } from "@/db/repo";
import { clubSnapshots, collectorRuns, matches } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import type { EaApi } from "@/lib/ea/api";
import type { EaResult } from "@/lib/ea/http";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const FIX = "tests/fixtures/ea/2026-10-23";
const fixtureEa = createFixtureEa(FIX);
const down: EaResult<never> = { ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("collect", () => {
  it("stores our 5 fixture games and a snapshot", async () => {
    const s = await collect({ db, ea: fixtureEa }, "manual", { recover: false });
    expect(s).toMatchObject({ status: "ok", newMatches: 5, recoveredMatches: 0, summaryMatches: 0, errors: [] });
    expect(await db.select().from(matches)).toHaveLength(5);
    const [snap] = await db.select().from(clubSnapshots);
    expect(snap).toMatchObject({ division: 8, wins: 11, losses: 9, promotions: 2, titles: 1 });
    expect(snap.seasonResults.slice(0, 4)).toEqual(["losses", "wins", "wins", "wins"]);
    expect(snap.recentResults).toHaveLength(10);
  });

  it("is idempotent on a second run", async () => {
    await collect({ db, ea: fixtureEa }, "manual", { recover: false });
    const s = await collect({ db, ea: fixtureEa }, "manual", { recover: false });
    expect(s).toMatchObject({ status: "ok", newMatches: 0 });
    expect(await db.select().from(matches)).toHaveLength(5);
  });

  it("continues when one match type fails", async () => {
    const ea: EaApi = {
      clubMatches: (id, type) => (type === "gameType10" ? Promise.resolve(down) : fixtureEa.clubMatches(id, type)),
      seasonalStats: fixtureEa.seasonalStats,
    };
    const s = await collect({ db, ea }, "manual", { recover: false });
    expect(s.status).toBe("partial");
    expect(s.newMatches).toBe(5);
    expect(s.errors).toHaveLength(1);
    expect(s.errors[0]).toContain("gameType10");
  });

  it("returns error status when EA is fully down and still logs the run", async () => {
    const ea: EaApi = { clubMatches: async () => down, seasonalStats: async () => down };
    const s = await collect({ db, ea }, "cron", { recover: false });
    expect(s.status).toBe("error");
    const [run] = await db.select().from(collectorRuns);
    expect(run).toMatchObject({ status: "error", trigger: "cron" });
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it("never throws on unexpected exceptions", async () => {
    const ea: EaApi = {
      clubMatches: async () => {
        throw new Error("boom");
      },
      seasonalStats: fixtureEa.seasonalStats,
    };
    const s = await collect({ db, ea }, "cron", { recover: false });
    expect(s.status).toBe("error");
    const [run] = await db.select().from(collectorRuns);
    expect(run.error).toContain("boom");
  });

  it("flags a gap when 5 new games are all newer than the stored newest", async () => {
    await insertMatchRow(db, {
      matchId: "old-1",
      playedAt: new Date("2026-10-01T20:00:00Z"),
      matchType: "gameType5",
      source: "full",
      opponentClubId: 42,
      goalsFor: 1,
      goalsAgainst: 0,
      outcome: "W",
      overtime: false,
      dnf: "none",
      resultCode: "1",
      timestampEstimated: false,
      raw: null,
    });
    const s = await collect({ db, ea: fixtureEa }, "cron", { recover: false });
    expect(s.warnings).toEqual(["possible-missed-games"]);
  });

  it("does not flag a gap when fewer than 5 games come back", async () => {
    await collect({ db, ea: fixtureEa }, "cron", { recover: false });
    const three: EaApi = {
      clubMatches: async (id, type) => {
        const r = await fixtureEa.clubMatches(id, type);
        if (!r.ok) return r;
        return { ok: true, data: r.data.slice(0, 3).map((m, i) => ({ ...m, matchId: `new-${i}`, timestamp: m.timestamp + 86400 })) };
      },
      seasonalStats: fixtureEa.seasonalStats,
    };
    const s = await collect({ db, ea: three }, "cron", { recover: false });
    expect(s.newMatches).toBe(3);
    expect(s.warnings).toEqual([]);
  });
});

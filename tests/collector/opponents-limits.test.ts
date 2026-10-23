import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { opponentSnapshots, scoutRequests } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { refreshOpponents } from "@/lib/collector/opponents";
import type { EaApi } from "@/lib/ea/api";
import type { EaResult } from "@/lib/ea/http";
import { createScoutRequest } from "@/lib/queries/opponents";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const fixtureEa = createFixtureEa("tests/fixtures/ea/2026-10-23");
const now = () => new Date("2026-10-23T12:00:00Z");
const down: EaResult<never> = { ok: false, error: { kind: "http", status: 403, message: "EA responded 403" } };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await collect({ db, ea: fixtureEa, now }, "seed", { opponents: false });
});

describe("opponent phase limits", () => {
  it("is skipped when our own run failed (EA down)", async () => {
    const clubInfo = vi.fn(async () => down);
    const searchClubs = vi.fn(async () => down);
    const ea: EaApi = { clubMatches: async () => down, seasonalStats: async () => down, members: async () => down, clubInfo, searchClubs };
    const s = await collect({ db, ea, now }, "cron");
    expect(s.status).toBe("error");
    expect(clubInfo).not.toHaveBeenCalled();
  });

  it("stops after the time budget", async () => {
    let t = 0;
    const clock = () => (t += 50_000); // every check is 50 s later
    const r = await refreshOpponents({ db, ea: fixtureEa, now }, { maxMs: 120_000, clock });
    expect(r.refreshed).toBeLessThan(6);
    expect(r.warnings).toContain("opponents-time-budget");
  });

  it("stops after 2 consecutive club failures", async () => {
    const clubInfo = vi.fn(async () => down);
    const ea: EaApi = { ...fixtureEa, clubInfo, members: async () => down, clubMatches: async () => down };
    await refreshOpponents({ db, ea, now });
    expect(clubInfo).toHaveBeenCalledTimes(2);
  });

  it("processes at most 2 scout requests per run", async () => {
    await db.insert(scoutRequests).values(["a", "b", "c"].map((q) => ({ query: `Sivudeke ${q}`, normalized: `sivudeke ${q}` })));
    await refreshOpponents({ db, ea: fixtureEa, now });
    const pending = (await db.select().from(scoutRequests)).filter((r) => r.status === "pending");
    expect(pending).toHaveLength(1);
  });

  it("gives up on a request after 3 failed attempts", async () => {
    await db.insert(scoutRequests).values({ query: "Sivudeke", normalized: "sivudeke" });
    const ea = { ...fixtureEa, searchClubs: async () => down };
    for (let i = 0; i < 3; i++) await refreshOpponents({ db, ea, now });
    const [req] = await db.select().from(scoutRequests);
    expect(req.status).toBe("error");
    expect(req.attempts).toBe(3);
  });

  it("scouts a known club by id without searching", async () => {
    const searchClubs = vi.fn(fixtureEa.searchClubs);
    expect(await createScoutRequest(db, "INFERNAL LEGION", 1808)).toBe("created");
    await refreshOpponents({ db, ea: { ...fixtureEa, searchClubs }, now });
    expect(searchClubs).not.toHaveBeenCalled();
    const [req] = await db.select().from(scoutRequests);
    expect(req).toMatchObject({ status: "done", clubId: 1808 });
  });

  it("keeps only the newest 3 snapshots per club", async () => {
    for (let i = 0; i < 4; i++) {
      await refreshOpponents({ db, ea: fixtureEa, now: () => new Date(Date.UTC(2026, 9, 23, 12 + i * 7)) });
    }
    const forInfernal = (await db.select().from(opponentSnapshots)).filter((s) => s.clubId === 1808);
    expect(forInfernal.length).toBeLessThanOrEqual(3);
  });
});

describe("scout request input", () => {
  it("collapses whitespace and rejects junk", async () => {
    expect(await createScoutRequest(db, "  Sivu   deke ")).toBe("created");
    expect(await createScoutRequest(db, "sivu deke")).toBe("exists");
    expect(await createScoutRequest(db, "!!!")).toBe("invalid");
    expect(await createScoutRequest(db, "a\u0000b")).toBe("invalid");
  });

  it("refuses when the queue is full", async () => {
    for (let i = 0; i < 20; i++) expect(await createScoutRequest(db, `club ${i}`)).toBe("created");
    expect(await createScoutRequest(db, "club 21")).toBe("busy");
  });
});

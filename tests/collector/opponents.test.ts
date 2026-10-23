import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { opponentSnapshots, scoutRequests } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { refreshOpponents } from "@/lib/collector/opponents";
import type { EaApi } from "@/lib/ea/api";
import type { EaResult } from "@/lib/ea/http";
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

describe("refreshOpponents", () => {
  it("refreshes recent opponents within the budget, then skips fresh ones", async () => {
    const first = await refreshOpponents({ db, ea: fixtureEa, now });
    expect(first.refreshed).toBe(6);
    const second = await refreshOpponents({ db, ea: fixtureEa, now });
    expect(second.refreshed).toBe(4); // the other 4 of our 10 opponents
    const third = await refreshOpponents({ db, ea: fixtureEa, now });
    expect(third.refreshed).toBe(0);
    const infernal = (await db.select().from(opponentSnapshots)).find((s) => s.clubId === 1808)!;
    expect(infernal.name).toBe("INFERNAL LEGION");
  });

  it("processes scout requests first", async () => {
    await db.insert(scoutRequests).values([
      { query: "Sivudeke", normalized: "sivudeke" },
      { query: "zzz", normalized: "zzz" },
    ]);
    await refreshOpponents({ db, ea: fixtureEa, now });
    const reqs = await db.select().from(scoutRequests);
    expect(reqs.find((r) => r.normalized === "sivudeke")).toMatchObject({ status: "done", clubId: 17024 });
    expect(reqs.find((r) => r.normalized === "zzz")).toMatchObject({ status: "not_found", clubId: null });
  });

  it("leaves a request pending when EA search fails", async () => {
    await db.insert(scoutRequests).values({ query: "Sivudeke", normalized: "sivudeke" });
    const r = await refreshOpponents({ db, ea: { ...fixtureEa, searchClubs: async () => down }, now });
    expect(r.warnings.some((w) => w.startsWith("scout-failed:"))).toBe(true);
    expect((await db.select().from(scoutRequests))[0].status).toBe("pending");
  });

  it("stores a snapshot with null profile for an inactive club", async () => {
    const ea: EaApi = { ...fixtureEa, clubMatches: async (id, t) => (id === 56507 ? fixtureEa.clubMatches(id, t) : { ok: true, data: [] }) };
    await refreshOpponents({ db, ea, now });
    const snaps = await db.select().from(opponentSnapshots);
    expect(snaps.length).toBe(6);
    expect(snaps.every((s) => s.profile === null)).toBe(true);
  });
});

describe("collect with opponents", () => {
  it("opponent failures are warnings, our own run stays ok", async () => {
    const ea: EaApi = {
      ...fixtureEa,
      clubMatches: async (id, t) => (id === 56507 ? fixtureEa.clubMatches(id, t) : down),
      clubInfo: async () => down,
      members: async (id) => (id === 56507 ? fixtureEa.members(id) : down),
    };
    const s = await collect({ db, ea, now }, "cron");
    expect(s.status).toBe("ok");
    expect(s.opponentsRefreshed).toBe(0);
    expect(s.warnings.some((w) => w.startsWith("opponent-failed:"))).toBe(true);
  });
});

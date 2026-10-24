import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { opponentSnapshots, scoutRequests } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { refreshOpponents } from "@/lib/collector/opponents";
import type { ClubSummary, EaApi } from "@/lib/ea/api";
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

describe("scouting a name that matches several clubs", () => {
  const club = (clubId: number, name: string, wins: number): ClubSummary => ({
    clubId, name, crestAssetId: null, division: 5, wins, losses: 1, otl: 0, seasonResults: [], raw: {},
  });
  const results = [club(901, "Hello Buddy", 53), club(902, "Hello Ji HC", 360), club(903, "Hello 1999", 2)];
  const ea: EaApi = { ...fixtureEa, searchClubs: async () => ({ ok: true, data: results }) };

  it("fully scouts the best match and saves the others so a search finds them", async () => {
    await db.insert(scoutRequests).values({ query: "Hello", normalized: "hello" });
    await refreshOpponents({ db, ea, now });
    expect((await db.select().from(scoutRequests))[0]).toMatchObject({ status: "done", clubId: 901, results: 3 });
    const snaps = await db.select().from(opponentSnapshots);
    expect(snaps.filter((s) => [901, 902, 903].includes(s.clubId))).toHaveLength(3);
    expect(snaps.find((s) => s.clubId === 902)).toMatchObject({ name: "Hello Ji HC", wins: 360, division: 5, members: null, profile: null });
  });

  it("an exact name match wins over the first result", async () => {
    await db.insert(scoutRequests).values({ query: "hello 1999", normalized: "hello 1999" });
    await refreshOpponents({ db, ea, now });
    expect((await db.select().from(scoutRequests))[0]).toMatchObject({ clubId: 903, results: 3 });
  });

  it("doesn't replace a fuller snapshot of a club we already know", async () => {
    await db.insert(opponentSnapshots).values({
      clubId: 902, takenAt: new Date("2026-10-22T12:00:00Z"), name: "Hello Ji HC", wins: 1, members: [], raw: {},
    });
    await db.insert(scoutRequests).values({ query: "Hello", normalized: "hello" });
    await refreshOpponents({ db, ea, now });
    const snaps902 = (await db.select().from(opponentSnapshots)).filter((s) => s.clubId === 902);
    expect(snaps902).toHaveLength(1);
    expect(snaps902[0].wins).toBe(1);
  });
});

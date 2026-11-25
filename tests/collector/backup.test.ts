import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { clubSnapshots, matches, matchPlayers } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { restoreBackups, takeBackup } from "@/lib/collector/backup";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const ea = createFixtureEa("tests/fixtures/ea/2026-10-23");

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("EA backups", () => {
  it("backs up our games and season stats, JSON-safe", async () => {
    const b = JSON.parse(JSON.stringify(await takeBackup(ea, new Date("2026-11-22T20:00:00Z"))));
    expect(b.matches.gameType5).toHaveLength(5);
    expect(b.seasonal).not.toBeNull();
    expect(b.errors).toEqual([]);
  });

  it("restores the same games the collector would store, and is safe to run twice", async () => {
    const backups = [
      JSON.parse(JSON.stringify(await takeBackup(ea, new Date("2026-11-22T20:00:00Z")))),
      JSON.parse(JSON.stringify(await takeBackup(ea, new Date("2026-11-22T20:10:00Z")))),
    ];
    const first = await restoreBackups(db, backups);
    expect(first).toMatchObject({ files: 2, newMatches: 5, snapshots: 2, errors: [] });
    const again = await restoreBackups(db, backups);
    expect(again.newMatches).toBe(0);

    const restored = await db.select().from(matches);
    const players = await db.select().from(matchPlayers);
    const direct = await createTestDb();
    await collect({ db: direct, ea }, "manual", { recover: false, opponents: false });
    expect(restored.map((m) => m.matchId).sort()).toEqual((await direct.select().from(matches)).map((m) => m.matchId).sort());
    expect(players).toHaveLength((await direct.select().from(matchPlayers)).length);
    expect(await db.select().from(clubSnapshots)).toHaveLength(4);
  });
});

describe("restoreBackups when the database is down", () => {
  it("stops after a few failures and reports the database's reason", async () => {
    const b = JSON.parse(JSON.stringify(await takeBackup(ea, new Date("2026-11-22T20:00:00Z"))));
    const quota = new Error("Failed query: insert into ...", { cause: new Error("Server error (HTTP status 402): exceeded the quota") });
    const broken = { insert: () => { throw quota; } } as unknown as Db;
    const r = await restoreBackups(broken, [b]);
    expect(r.newMatches).toBe(0);
    expect(r.errors).toHaveLength(4);
    expect(r.errors[0]).toContain("HTTP status 402");
    expect(r.errors.at(-1)).toContain("stopped");
  });
});

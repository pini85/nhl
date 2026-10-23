import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { opponentSnapshots } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import {
  allClubRows,
  createScoutRequest,
  latestOpponentSnapshot,
  opponentLines,
  recentScoutRequests,
  scoutedClubs,
} from "@/lib/queries/opponents";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const now = () => new Date("2026-10-23T12:00:00Z");
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await collect({ db, ea: createFixtureEa("tests/fixtures/ea/2026-10-23"), now }, "seed", { opponents: false });
});

const snap = (clubId: number, takenAt: string, name: string) => ({ clubId, takenAt: new Date(takenAt), name, raw: {} });

describe("scout requests", () => {
  it("dedupes pending requests by normalized name", async () => {
    expect(await createScoutRequest(db, "Sivudeke ")).toBe("created");
    expect(await createScoutRequest(db, "sivudeke")).toBe("exists");
    expect(await recentScoutRequests(db)).toHaveLength(1);
  });
  it("rejects empty or very long queries", async () => {
    expect(await createScoutRequest(db, "   ")).toBe("invalid");
    expect(await createScoutRequest(db, "x".repeat(41))).toBe("invalid");
  });
});

describe("opponent snapshots", () => {
  it("returns the newest snapshot for a club", async () => {
    await db.insert(opponentSnapshots).values([snap(1808, "2026-10-23T01:00:00Z", "old"), snap(1808, "2026-10-23T09:00:00Z", "new")]);
    expect((await latestOpponentSnapshot(db, 1808))?.name).toBe("new");
    expect(await latestOpponentSnapshot(db, 42)).toBeNull();
  });
  it("lists the latest snapshot per scouted club", async () => {
    await db.insert(opponentSnapshots).values([
      snap(1808, "2026-10-23T01:00:00Z", "old"),
      snap(1808, "2026-10-23T09:00:00Z", "new"),
      snap(77, "2026-10-23T02:00:00Z", "Never Played"),
    ]);
    const s = await scoutedClubs(db);
    expect(s.map((x) => [x.clubId, x.name]).sort()).toEqual([
      [1808, "new"],
      [77, "Never Played"],
    ]);
  });
});

describe("club rows and opponent lines", () => {
  it("returns match club rows and a club's player lines", async () => {
    expect((await allClubRows(db)).length).toBe(18); // 9 full games × 2 clubs
    expect(await opponentLines(db, 1808)).toHaveLength(6);
  });
});

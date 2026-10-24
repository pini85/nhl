import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { eq } from "drizzle-orm";
import { clubSnapshots, extraPlayerStats, matches } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { allGames, extraStats, latestSnapshot, matchDetail, ourPlayerLines, playerDetail, snapshotHistory } from "@/lib/queries/club";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("club queries on an empty database", () => {
  it("return empty results", async () => {
    expect(await latestSnapshot(db)).toBeNull();
    expect(await allGames(db)).toEqual([]);
    expect(await ourPlayerLines(db)).toEqual([]);
    expect(await matchDetail(db, "nope")).toBeNull();
    expect(await playerDetail(db, "nope")).toBeNull();
  });
});

describe("club queries after collecting the fixtures", () => {
  beforeEach(async () => {
    await collect(
      { db, ea: createFixtureEa("tests/fixtures/ea/2026-10-23"), now: () => new Date("2026-10-23T12:00:00Z") },
      "seed",
    );
  });

  it("latest snapshot has division and roster", async () => {
    const s = await latestSnapshot(db);
    expect(s?.division).toBe(8);
    expect(s?.members).toHaveLength(4);
  });

  it("lists all games with opponent names", async () => {
    const g = await allGames(db);
    expect(g).toHaveLength(10);
    expect(g.find((x) => x.matchId === "2782817800237")?.opponentName).toBe("INFERNAL LEGION");
    expect(g.find((x) => x.source === "summary")?.opponentName).toBeNull();
  });

  it("uses the stored opponent name for games without a box score", async () => {
    await db.update(matches).set({ opponentName: "Old Boys" }).where(eq(matches.source, "summary"));
    const g = await allGames(db);
    expect(g.find((x) => x.source === "summary")?.opponentName).toBe("Old Boys");
    expect(g.find((x) => x.matchId === "2782817800237")?.opponentName).toBe("INFERNAL LEGION");
  });

  it("reads extra player stats", async () => {
    expect(await extraStats(db)).toEqual([]);
    await db.insert(extraPlayerStats).values({
      eaPlayerId: "802564056", playerName: "Popomasta-SMB", coversFrom: new Date("2026-10-15T19:42:49Z"),
      gp: 11, goals: 2, assists: 3, plusMinus: 4, shots: 14, hits: 7, pim: 2, ppg: 0, shg: 0, takeaways: 35, giveaways: 27,
    });
    expect(await extraStats(db)).toEqual([expect.objectContaining({ eaPlayerId: "802564056", gp: 11, goals: 2, takeaways: 35 })]);
  });

  it("returns only our player lines", async () => {
    const l = await ourPlayerLines(db);
    expect(l.every((x) => x.clubId === 56507)).toBe(true);
    expect(l).toHaveLength(54); // 9 full games × 6
  });

  it("returns match detail", async () => {
    const m = await matchDetail(db, "2782817800237");
    expect(m?.clubs).toHaveLength(2);
    expect(m?.lines).toHaveLength(12);
    expect(m?.game.goalsAgainst).toBe(4);
  });

  it("returns a summary match without box scores", async () => {
    const id = (await allGames(db)).find((x) => x.source === "summary")!.matchId;
    const m = await matchDetail(db, id);
    expect(m?.clubs).toEqual([]);
    expect(m?.lines).toEqual([]);
  });

  it("returns our lines oldest game first so the newest name wins", async () => {
    const l = (await ourPlayerLines(db)).filter((x) => x.eaPlayerId === "828785353");
    expect(l[0].matchId).toBe("2602324540070"); // Sun Oct 18
    expect(l.at(-1)?.matchId).toBe("2782817800237"); // Thu Oct 22, last game
  });

  it("falls back to the last known roster when the newest snapshot has none", async () => {
    const s = (await latestSnapshot(db))!;
    await db.insert(clubSnapshots).values({ ...s, id: undefined, takenAt: new Date("2026-10-24T12:00:00Z"), members: null });
    expect((await latestSnapshot(db))?.members).toHaveLength(4);
  });

  it("returns the division history of snapshots", async () => {
    const h = await snapshotHistory(db);
    expect(h).toEqual([{ takenAt: new Date("2026-10-23T12:00:00Z"), division: 8 }]);
  });

  it("returns player detail", async () => {
    const p = await playerDetail(db, "828785353");
    expect(p?.lines).toHaveLength(9);
    expect(p?.games).toHaveLength(9);
  });
});

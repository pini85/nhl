import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { arcadeKnocks, arcadeRooms } from "@/db/schema";
import { answerKnock, CODE_RE, createRoom, ensureRooms, knock, knockAnswer, MAX_KNOCKS, normalizeCode, pendingKnocks } from "@/lib/arcade/rooms";
import { sql } from "drizzle-orm";
import { createTestDb } from "../helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("arcade rooms", () => {
  it("lets several phones knock, and only the host answers", async () => {
    await ensureRooms(db);
    const { code, key } = await createRoom(db);
    expect(code).toMatch(CODE_RE);
    const a = (await knock(db, code, "offer-a")) as string;
    const b = (await knock(db, code, "offer-b")) as string;
    expect(await pendingKnocks(db, code, key)).toEqual([
      { id: a, offer: "offer-a" },
      { id: b, offer: "offer-b" },
    ]);
    expect(await pendingKnocks(db, code, "not-the-key")).toBeNull();
    expect(await knockAnswer(db, a)).toBeNull();
    expect(await answerKnock(db, code, "not-the-key", a, "answer-a")).toBe(false);
    expect(await answerKnock(db, code, key, a, "answer-a")).toBe(true);
    expect(await answerKnock(db, code, key, a, "again")).toBe(false);
    expect(await knockAnswer(db, a)).toBe("answer-a");
    expect(await pendingKnocks(db, code, key)).toEqual([{ id: b, offer: "offer-b" }]);
  });

  it("turns away knocks on a missing room, and too many at once", async () => {
    expect(await knock(db, "ZZZZ", "offer")).toBeNull();
    const { code } = await createRoom(db);
    for (let i = 0; i < MAX_KNOCKS; i++) await knock(db, code, `offer-${i}`);
    expect(await knock(db, code, "one-more")).toBe("busy");
  });

  it("forgets a room 15 minutes after the host last checked in", async () => {
    const { code, key } = await createRoom(db);
    await db.update(arcadeRooms).set({ createdAt: sql`now() - interval '10 minutes'` });
    expect(await pendingKnocks(db, code, key)).toEqual([]); // checking in keeps it open
    await db.update(arcadeRooms).set({ createdAt: sql`now() - interval '16 minutes'` });
    expect(await pendingKnocks(db, code, key)).toBeNull();
    expect(await knock(db, code, "late")).toBeNull();
  });

  it("drops a knock nobody answered", async () => {
    const { code, key } = await createRoom(db);
    const id = (await knock(db, code, "offer")) as string;
    await db.update(arcadeKnocks).set({ createdAt: sql`now() - interval '2 minutes'` });
    expect(await pendingKnocks(db, code, key)).toEqual([]);
    expect(await knockAnswer(db, id)).toBeUndefined();
  });

  it("reads codes the way people type them", () => {
    expect(normalizeCode(" ab-cd ")).toBe("ABCD");
    expect(CODE_RE.test("AB0D")).toBe(false); // no zero: it looks like O
  });
});

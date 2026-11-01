import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { arcadeRooms } from "@/db/schema";
import { answerRoom, CODE_RE, createRoom, ensureRooms, getRoom, normalizeCode } from "@/lib/arcade/rooms";
import { sql } from "drizzle-orm";
import { createTestDb } from "../helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("arcade rooms", () => {
  it("hands out a code, then takes exactly one answer", async () => {
    await ensureRooms(db);
    const code = await createRoom(db, "offer-sdp");
    expect(code).toMatch(CODE_RE);
    expect(await getRoom(db, code)).toEqual({ offer: "offer-sdp", answer: null });
    expect(await answerRoom(db, code, "answer-1")).toBe(true);
    expect(await answerRoom(db, code, "answer-2")).toBe(false);
    expect((await getRoom(db, code))?.answer).toBe("answer-1");
  });

  it("forgets rooms after 15 minutes", async () => {
    const code = await createRoom(db, "old");
    await db.update(arcadeRooms).set({ createdAt: sql`now() - interval '16 minutes'` });
    expect(await getRoom(db, code)).toBeNull();
    expect(await answerRoom(db, code, "late")).toBe(false);
  });

  it("reads codes the way people type them", () => {
    expect(normalizeCode(" ab-cd ")).toBe("ABCD");
    expect(CODE_RE.test("AB0D")).toBe(false); // no zero: it looks like O
  });
});

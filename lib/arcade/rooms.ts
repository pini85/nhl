import { and, asc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { arcadeKnocks, arcadeRooms } from "@/db/schema";

// Room codes for online arcade games. The host opens a room; each phone that wants in leaves its
// WebRTC offer as a "knock", the host answers it, and from then on game traffic goes phone to phone.

export const ROOM_MINUTES = 15; // a room lasts this long after the host last checked in
export const KNOCK_SECONDS = 60; // an unanswered knock is dropped after this
export const MAX_KNOCKS = 8; // waiting at once, per room
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
export const CODE_RE = /^[A-HJKMNP-Z2-9]{4}$/;

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

function pick(n: number, from = LETTERS) {
  let c = "";
  for (let i = 0; i < n; i++) c += from[Math.floor(Math.random() * from.length)];
  return c;
}
const secret = () => (globalThis.crypto?.randomUUID?.() ?? pick(32, "abcdefghijklmnopqrstuvwxyz0123456789")).replace(/-/g, "");

const fresh = () => gt(arcadeRooms.createdAt, sql`now() - make_interval(mins => ${ROOM_MINUTES})`);
const freshKnock = () => gt(arcadeKnocks.createdAt, sql`now() - make_interval(secs => ${KNOCK_SECONDS})`);

let ready: Promise<unknown> | null = null;
/** The tables appear on first use, so online play works before anyone runs migrations. */
export function ensureRooms(db: Db) {
  ready ??= (async () => {
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS "arcade_rooms" ("code" text PRIMARY KEY NOT NULL, "offer" text NOT NULL, "answer" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    );
    await db.execute(sql`ALTER TABLE "arcade_rooms" ADD COLUMN IF NOT EXISTS "host_key" text`);
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS "arcade_knocks" ("id" text PRIMARY KEY NOT NULL, "code" text NOT NULL, "offer" text NOT NULL, "answer" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    );
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** Opens a room. The key proves later that a request comes from the host. */
export async function createRoom(db: Db): Promise<{ code: string; key: string }> {
  await db.delete(arcadeRooms).where(lt(arcadeRooms.createdAt, sql`now() - make_interval(mins => ${ROOM_MINUTES})`));
  await db.delete(arcadeKnocks).where(lt(arcadeKnocks.createdAt, sql`now() - make_interval(mins => ${ROOM_MINUTES})`));
  const key = secret();
  for (let i = 0; i < 8; i++) {
    const code = pick(4);
    const rows = await db.insert(arcadeRooms).values({ code, offer: "", hostKey: key }).onConflictDoNothing().returning({ code: arcadeRooms.code });
    if (rows.length) return { code, key };
  }
  throw new Error("no free room code");
}

export async function roomOpen(db: Db, code: string) {
  const [row] = await db.select({ code: arcadeRooms.code }).from(arcadeRooms).where(and(eq(arcadeRooms.code, code), fresh(), sql`${arcadeRooms.hostKey} IS NOT NULL`));
  return !!row;
}

/** A phone asks to join. Null when there is no such room, "busy" when too many are waiting. */
export async function knock(db: Db, code: string, offer: string): Promise<string | null | "busy"> {
  if (!(await roomOpen(db, code))) return null;
  const waiting = await db
    .select({ id: arcadeKnocks.id })
    .from(arcadeKnocks)
    .where(and(eq(arcadeKnocks.code, code), isNull(arcadeKnocks.answer), freshKnock()));
  if (waiting.length >= MAX_KNOCKS) return "busy";
  const id = secret();
  await db.insert(arcadeKnocks).values({ id, code, offer });
  return id;
}

/** The host's check-in: knocks still to answer. It also keeps the room alive. Null if the key is wrong. */
export async function pendingKnocks(db: Db, code: string, key: string): Promise<{ id: string; offer: string }[] | null> {
  const rows = await db
    .update(arcadeRooms)
    .set({ createdAt: sql`now()` })
    .where(and(eq(arcadeRooms.code, code), eq(arcadeRooms.hostKey, key), fresh()))
    .returning({ code: arcadeRooms.code });
  if (!rows.length) return null;
  return db
    .select({ id: arcadeKnocks.id, offer: arcadeKnocks.offer })
    .from(arcadeKnocks)
    .where(and(eq(arcadeKnocks.code, code), isNull(arcadeKnocks.answer), freshKnock()))
    .orderBy(asc(arcadeKnocks.createdAt));
}

/** The host answers one knock. */
export async function answerKnock(db: Db, code: string, key: string, id: string, answer: string): Promise<boolean> {
  if (!(await pendingKnocks(db, code, key))) return false;
  const rows = await db
    .update(arcadeKnocks)
    .set({ answer })
    .where(and(eq(arcadeKnocks.id, id), eq(arcadeKnocks.code, code), isNull(arcadeKnocks.answer)))
    .returning({ id: arcadeKnocks.id });
  return rows.length > 0;
}

/** The joining phone's check: the host's answer, null while waiting, undefined if the knock is gone. */
export async function knockAnswer(db: Db, id: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ answer: arcadeKnocks.answer })
    .from(arcadeKnocks)
    .where(and(eq(arcadeKnocks.id, id), sql`(${arcadeKnocks.answer} IS NOT NULL OR ${freshKnock()})`));
  return row ? row.answer : undefined;
}

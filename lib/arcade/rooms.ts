import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { arcadeRooms } from "@/db/schema";

// Room codes for online arcade games: the host's WebRTC offer waits here for the guest's answer.

export const ROOM_MINUTES = 15;
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
export const CODE_RE = /^[A-HJKMNP-Z2-9]{4}$/;

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

function newCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return c;
}

const fresh = () => gt(arcadeRooms.createdAt, sql`now() - make_interval(mins => ${ROOM_MINUTES})`);

let ready: Promise<unknown> | null = null;
/** The table appears on first use, so online play works before anyone runs migrations. */
export function ensureRooms(db: Db) {
  ready ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS "arcade_rooms" ("code" text PRIMARY KEY NOT NULL, "offer" text NOT NULL, "answer" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    )
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

export async function createRoom(db: Db, offer: string): Promise<string> {
  await db.delete(arcadeRooms).where(lt(arcadeRooms.createdAt, sql`now() - make_interval(mins => ${ROOM_MINUTES})`));
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    const rows = await db.insert(arcadeRooms).values({ code, offer }).onConflictDoNothing().returning({ code: arcadeRooms.code });
    if (rows.length) return code;
  }
  throw new Error("no free room code");
}

export async function getRoom(db: Db, code: string) {
  const [row] = await db
    .select({ offer: arcadeRooms.offer, answer: arcadeRooms.answer })
    .from(arcadeRooms)
    .where(and(eq(arcadeRooms.code, code), fresh()));
  return row ?? null;
}

/** First answer wins: a room is for two. */
export async function answerRoom(db: Db, code: string, answer: string): Promise<boolean> {
  const rows = await db
    .update(arcadeRooms)
    .set({ answer })
    .where(and(eq(arcadeRooms.code, code), isNull(arcadeRooms.answer), fresh()))
    .returning({ code: arcadeRooms.code });
  return rows.length > 0;
}

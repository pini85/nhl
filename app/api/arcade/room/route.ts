import { z } from "zod";
import { getDb } from "@/db/client";
import { answerRoom, CODE_RE, createRoom, ensureRooms, getRoom, normalizeCode } from "@/lib/arcade/rooms";

// The handshake for online arcade games. Game traffic itself goes phone to phone.

const Sdp = z.string().min(10).max(20_000);
const Code = z.string().transform(normalizeCode).pipe(z.string().regex(CODE_RE));
const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), sdp: Sdp }),
  z.object({ op: z.literal("get"), code: Code }),
  z.object({ op: z.literal("answer"), code: Code, sdp: Sdp }),
]);

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
const ok = (body: unknown) => Response.json(body, { headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("That code doesn't look right.", 400);
  const b = parsed.data;
  const db = getDb();
  await ensureRooms(db);
  if (b.op === "create") return ok({ code: await createRoom(db, b.sdp) });
  const room = await getRoom(db, b.code);
  if (!room) return fail("No room with that code. Check it, or ask for a new one.", 404);
  if (b.op === "get") return ok(room);
  if (!(await answerRoom(db, b.code, b.sdp))) return fail("Someone already joined that room.", 409);
  return ok({ ok: true });
}

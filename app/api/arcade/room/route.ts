import { z } from "zod";
import { getDb } from "@/db/client";
import { answerKnock, CODE_RE, createRoom, ensureRooms, knock, knockAnswer, normalizeCode, pendingKnocks } from "@/lib/arcade/rooms";

// The handshake for online arcade games. Game traffic itself goes phone to phone.
// Open to other origins: the Ice Hockey Android app uses these rooms too.

const Sdp = z.string().min(10).max(20_000);
const Code = z.string().transform(normalizeCode).pipe(z.string().regex(CODE_RE));
const Id = z.string().regex(/^[a-z0-9]{16,64}$/);
const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create") }),
  z.object({ op: z.literal("knock"), code: Code, sdp: Sdp }),
  z.object({ op: z.literal("reply"), id: Id }),
  z.object({ op: z.literal("knocks"), code: Code, key: Id }),
  z.object({ op: z.literal("answer"), code: Code, key: Id, id: Id, sdp: Sdp }),
]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};
const headers = { "cache-control": "no-store", ...CORS };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
const ok = (body: unknown) => Response.json(body, { headers });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("That code doesn't look right.", 400);
  const b = parsed.data;
  const db = getDb();
  await ensureRooms(db);
  switch (b.op) {
    case "create":
      return ok(await createRoom(db));
    case "knock": {
      const id = await knock(db, b.code, b.sdp);
      if (id === null) return fail("No room with that code. Check it, or ask for a new one.", 404);
      if (id === "busy") return fail("That room is busy. Try again in a moment.", 429);
      return ok({ id });
    }
    case "reply": {
      const answer = await knockAnswer(db, b.id);
      if (answer === undefined) return fail("The room didn't let you in. It may be full, or in a game.", 404);
      return ok({ answer });
    }
    case "knocks": {
      const knocks = await pendingKnocks(db, b.code, b.key);
      if (!knocks) return fail("Your room closed. Open a new one.", 404);
      return ok({ knocks });
    }
    case "answer":
      if (!(await answerKnock(db, b.code, b.key, b.id, b.sdp))) return fail("That phone stopped waiting.", 409);
      return ok({ ok: true });
  }
}

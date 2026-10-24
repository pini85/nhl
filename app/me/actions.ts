"use server";

import { cookies } from "next/headers";
import { getOurLines } from "@/lib/data/club";
import { addSeen, COOKIE_OPTIONS, PLAYER_COOKIE, parseMe, parseSeen, SEEN_COOKIE } from "@/lib/me";
import { loadMomentInput } from "@/lib/me-server";
import { activeMoments } from "@/lib/stats/moments";

const WELCOME_DAYS = 7;

async function activeIds() {
  const now = new Date();
  const list = activeMoments(await loadMomentInput(), now);
  return { list, ids: new Set(list.map((m) => m.id)), now };
}

/** A teammate picks themselves ("guest" = not on the team). New pickers only see the last week's moments as new. */
export async function choosePlayer(choice: string): Promise<void> {
  const jar = await cookies();
  if (choice === "guest") {
    jar.set(PLAYER_COOKIE, "guest", COOKIE_OPTIONS);
    return;
  }
  const lines = await getOurLines();
  if (!/^\d+$/.test(choice) || !lines.some((l) => l.eaPlayerId === choice)) return;
  jar.set(PLAYER_COOKIE, choice, COOKIE_OPTIONS);
  const { list, ids, now } = await activeIds();
  const older = list.filter((m) => now.getTime() - m.at.getTime() > WELCOME_DAYS * 86_400_000).map((m) => m.id);
  jar.set(SEEN_COOKIE, addSeen(parseSeen(jar.get(SEEN_COOKIE)?.value), older, ids).join(","), COOKIE_OPTIONS);
}

/** Closed onboarding without picking. Never overwrites a pick. */
export async function skipOnboarding(): Promise<void> {
  const [jar, lines] = await Promise.all([cookies(), getOurLines()]);
  const me = parseMe(jar.get(PLAYER_COOKIE)?.value, new Set(lines.map((l) => l.eaPlayerId)));
  if (me.kind === "unset") jar.set(PLAYER_COOKIE, "skipped", COOKIE_OPTIONS);
}

export async function markSeen(ids: string[]): Promise<void> {
  if (!Array.isArray(ids)) return;
  const jar = await cookies();
  const { ids: active } = await activeIds();
  jar.set(SEEN_COOKIE, addSeen(parseSeen(jar.get(SEEN_COOKIE)?.value), ids.map(String).slice(0, 60), active).join(","), COOKIE_OPTIONS);
}

/** "Not you? Switch player". */
export async function clearPlayer(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE);
}

// Server-side reads of who is looking. Personal pieces read the clock only through requestTime().
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getExtraStats, getGames, getOurLines, getSnapshotHistory } from "@/lib/data/club";
import { getClubRows } from "@/lib/data/opponents";
import { CLUB_ID } from "@/lib/config";
import { type Me, PLAYER_COOKIE, parseMe, parseSeen, SEEN_COOKIE } from "@/lib/me";
import type { MomentInput } from "@/lib/stats/moments";

export async function getMe(): Promise<{ me: Me; seen: string[] }> {
  const [jar, lines] = await Promise.all([cookies(), getOurLines()]);
  const known = new Set(lines.map((l) => l.eaPlayerId));
  return { me: parseMe(jar.get(PLAYER_COOKIE)?.value, known), seen: parseSeen(jar.get(SEEN_COOKIE)?.value) };
}

export async function loadMomentInput(): Promise<MomentInput> {
  const [lines, games, clubs, extras, history] = await Promise.all([getOurLines(), getGames(), getClubRows(), getExtraStats(), getSnapshotHistory()]);
  return { lines, games, clubs, extras, history, ourClubId: CLUB_ID };
}

/** The current time, at request time only (prerendering stops at connection()). */
export async function requestTime(): Promise<Date> {
  await connection();
  return new Date();
}

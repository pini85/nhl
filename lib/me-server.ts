// Server-side reads of who is looking. Call getMe() before reading the clock (prerendering rule).
import { cookies } from "next/headers";
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

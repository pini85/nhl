// Posts last night's recap to Discord once per game night.
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { discordPosts } from "@/db/schema";
import { CLUB_ID } from "@/lib/config";
import { factsForWriter, nightToPost, recapFacts, recapMessage } from "@/lib/discord/recap";
import { groupGameNights, type GameNight } from "@/lib/stats/nights";
import type { GameLite } from "@/lib/stats/types";
import { allGames, extraStats, ourPlayerLines, snapshotHistory } from "@/lib/queries/club";
import { allClubRows } from "@/lib/queries/opponents";

export type PostDeps = {
  db: Db;
  now: Date;
  webhookUrl: string;
  siteUrl: string;
  postHour?: number;
  fetch?: typeof fetch;
  writeIntro?: (facts: string) => Promise<string | null>;
};

export type PostResult = { status: "posted" | "nothing" | "error"; nightKey?: string; error?: string };

export async function postNightRecap(deps: PostDeps): Promise<PostResult> {
  const { db, now } = deps;
  const games = await allGames(db);
  const posted = new Set((await db.select({ key: discordPosts.nightKey }).from(discordPosts)).map((r) => r.key));
  const night = nightToPost(games, now, posted, deps.postHour);
  if (!night) return { status: "nothing" };

  // Claim the night first so two runs can't both post it; released again if Discord fails.
  const claimed = await db.insert(discordPosts).values({ nightKey: night.key }).onConflictDoNothing().returning();
  if (!claimed.length) return { status: "nothing" };

  try {
    await sendToDiscord(deps, await buildRecap(deps, games, night));
    return { status: "posted", nightKey: night.key };
  } catch (e) {
    await db.delete(discordPosts).where(eq(discordPosts.nightKey, night.key));
    return { status: "error", nightKey: night.key, error: e instanceof Error ? e.message : String(e) };
  }
}

async function buildRecap(deps: Pick<PostDeps, "db" | "siteUrl" | "writeIntro">, games: GameLite[], night: GameNight): Promise<string> {
  const { db } = deps;
  const [lines, clubs, extras, history] = await Promise.all([ourPlayerLines(db), allClubRows(db), extraStats(db), snapshotHistory(db)]);
  const facts = recapFacts(night, { games, lines, clubs, extras, history, ourClubId: CLUB_ID }, deps.siteUrl);
  if (!facts) throw new Error(`no recap for ${night.key}`);
  const intro = deps.writeIntro ? await deps.writeIntro(factsForWriter(facts)) : null;
  return recapMessage(facts, intro);
}

async function sendToDiscord(deps: Pick<PostDeps, "webhookUrl" | "fetch">, content: string): Promise<void> {
  const res = await (deps.fetch ?? fetch)(deps.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // No @everyone or player pings from gamertags.
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) throw new Error(`Discord answered ${res.status}: ${await res.text().catch(() => "")}`);
}

export const WELCOME = `👋 **Hi, I'm the Drop drop drop recap bot!**
Every morning at **8:00 CET** after a game night, I'll post a recap of last night's games here:
• the night's record and every score
• ⭐ Night MVP, three stars and the night's leaders
• 🏆 club records, milestones and awards
• 📈 how the night compares with the rest of the season
• 🔗 a link to the full night page on the site
No games, no post. Here's a sample using the most recent game night 👇`;

/** Test: the welcome message, then the newest night's recap. Doesn't mark anything as posted. */
export async function postSample(deps: Omit<PostDeps, "now" | "postHour">): Promise<string | null> {
  const games = await allGames(deps.db);
  const night = groupGameNights(games)[0];
  await sendToDiscord(deps, WELCOME);
  if (!night) return null;
  await sendToDiscord(deps, await buildRecap(deps, games, night));
  return night.key;
}

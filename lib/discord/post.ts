// Posts last night's recap to Discord once per game night.
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { discordPosts } from "@/db/schema";
import { CLUB_ID } from "@/lib/config";
import { factsForWriter, nightToPost, recapFacts, recapMessage } from "@/lib/discord/recap";
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
    const [lines, clubs, extras, history] = await Promise.all([ourPlayerLines(db), allClubRows(db), extraStats(db), snapshotHistory(db)]);
    const facts = recapFacts(night, { games, lines, clubs, extras, history, ourClubId: CLUB_ID }, deps.siteUrl);
    if (!facts) throw new Error(`no recap for ${night.key}`);
    const intro = deps.writeIntro ? await deps.writeIntro(factsForWriter(facts)) : null;

    const res = await (deps.fetch ?? fetch)(deps.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No @everyone or player pings from gamertags.
      body: JSON.stringify({ content: recapMessage(facts, intro), allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) throw new Error(`Discord answered ${res.status}: ${await res.text().catch(() => "")}`);
    return { status: "posted", nightKey: night.key };
  } catch (e) {
    await db.delete(discordPosts).where(eq(discordPosts.nightKey, night.key));
    return { status: "error", nightKey: night.key, error: e instanceof Error ? e.message : String(e) };
  }
}

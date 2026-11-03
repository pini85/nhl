// The game night poll: who can play tonight, and at what time. Posted through the Discord webhook.
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { discordPosts } from "@/db/schema";

export const POLL_TIMES = ["19:30 CET", "20:00 CET", "20:30 CET", "21:00 CET", "21:30 CET"];
export const CANT_PLAY = "I have a life. Can't play today.";
export const POLL_HOURS = 16;

export function gameNightPoll() {
  return {
    question: { text: "🏒 Game night! What time can you play?" },
    answers: [
      ...POLL_TIMES.map((text) => ({ poll_media: { text, emoji: { name: "🕒" } } })),
      { poll_media: { text: CANT_PLAY, emoji: { name: "❌" } } },
    ],
    duration: POLL_HOURS,
    allow_multiselect: false,
    layout_type: 1,
  };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });

export type PollResult = { status: "posted" | "already" | "error"; detail?: string };

/** Posts the poll at most once per (Amsterdam) day, so a double tap can't post it twice. */
export async function postGameNightPoll(deps: { db: Db; now: Date; webhookUrl: string; fetch?: typeof fetch }): Promise<PollResult> {
  // Shares the recap's table: its keys are plain dates, these start with "poll:".
  const key = `poll:${dayFmt.format(deps.now)}`;
  const claimed = await deps.db.insert(discordPosts).values({ nightKey: key }).onConflictDoNothing().returning();
  if (!claimed.length) return { status: "already" };

  let detail: string;
  try {
    const res = await (deps.fetch ?? fetch)(deps.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ poll: gameNightPoll(), allowed_mentions: { parse: [] } }),
    });
    if (res.ok) return { status: "posted" };
    detail = `Discord answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
  } catch (e) {
    detail = `Couldn't reach Discord: ${e instanceof Error ? e.message : String(e)}`;
  }
  await deps.db.delete(discordPosts).where(eq(discordPosts.nightKey, key));
  return { status: "error", detail };
}

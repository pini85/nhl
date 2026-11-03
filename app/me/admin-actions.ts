"use server";

import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { ADMIN_PLAYER_ID } from "@/lib/config";
import { postGameNightPoll, type PollResult } from "@/lib/discord/poll";
import { PLAYER_COOKIE } from "@/lib/me";

/** The admin's "post the game night poll" button. Errors are spelled out: only the admin sees them. */
export async function postPoll(): Promise<PollResult | { status: "forbidden" }> {
  const jar = await cookies();
  if (jar.get(PLAYER_COOKIE)?.value !== ADMIN_PLAYER_ID) return { status: "forbidden" };
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { status: "error", detail: "DISCORD_WEBHOOK_URL isn't set in Vercel. Add it, then redeploy." };
  try {
    const result = await postGameNightPoll({ db: getDb(), now: new Date(), webhookUrl });
    if (result.detail) console.error("game night poll:", result.detail);
    return result;
  } catch (e) {
    console.error("game night poll:", e);
    return { status: "error", detail: `Database error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

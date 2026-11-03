"use server";

import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { ADMIN_PLAYER_ID } from "@/lib/config";
import { postGameNightPoll, type PollResult } from "@/lib/discord/poll";
import { PLAYER_COOKIE } from "@/lib/me";

/** The admin's "post the game night poll" button. */
export async function postPoll(): Promise<PollResult | "forbidden"> {
  const jar = await cookies();
  if (jar.get(PLAYER_COOKIE)?.value !== ADMIN_PLAYER_ID) return "forbidden";
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return "error";
  return postGameNightPoll({ db: getDb(), now: new Date(), webhookUrl });
}

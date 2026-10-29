// Sends the bot's welcome message and a sample recap of the newest night (nothing is marked as posted).
import { getDb } from "@/db/client";
import { postSample } from "@/lib/discord/post";
import { writeIntro } from "@/lib/discord/writer";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const siteUrl = process.env.SITE_URL;
if (!webhookUrl || !siteUrl) throw new Error("DISCORD_WEBHOOK_URL and SITE_URL must be set");

const key = await postSample({ db: getDb(), webhookUrl, siteUrl, writeIntro });
console.log(`discord test: sent welcome${key ? ` and the recap of ${key}` : ""}`);
process.exit(0);

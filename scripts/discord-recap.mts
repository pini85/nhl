// Runs after each collector run: posts last night's recap to Discord once the night is over.
// Needs DISCORD_WEBHOOK_URL and SITE_URL; ANTHROPIC_API_KEY (optional) adds a written intro.
import { getDb } from "@/db/client";
import { postNightRecap } from "@/lib/discord/post";
import { writeIntro } from "@/lib/discord/writer";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const siteUrl = process.env.SITE_URL;
if (!webhookUrl || !siteUrl) {
  console.log("discord: DISCORD_WEBHOOK_URL or SITE_URL not set, skipping");
  process.exit(0);
}

const r = await postNightRecap({
  db: getDb(),
  now: new Date(),
  webhookUrl,
  siteUrl,
  postHour: process.env.DISCORD_POST_HOUR ? Number(process.env.DISCORD_POST_HOUR) : undefined,
  writeIntro,
});
console.log(`discord: ${JSON.stringify(r)}`);
process.exit(r.status === "error" ? 1 : 0);

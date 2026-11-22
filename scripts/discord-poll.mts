// Posts the game night poll to Discord (run from the Actions tab: discord-poll).
// Uses the database to avoid posting twice in a day; if the database is down, posts anyway.
import { getDb } from "@/db/client";
import { gameNightPoll, postGameNightPoll } from "@/lib/discord/poll";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
  console.log("discord-poll: DISCORD_WEBHOOK_URL not set");
  process.exit(1);
}

try {
  const r = await postGameNightPoll({ db: getDb(), now: new Date(), webhookUrl });
  console.log(`discord-poll: ${JSON.stringify(r)}`);
  process.exit(r.status === "error" ? 1 : 0);
} catch (e) {
  console.log(`discord-poll: database unavailable (${e instanceof Error ? e.message : e}), posting without the once-a-day check`);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ poll: gameNightPoll(), allowed_mentions: { parse: [] } }),
  });
  console.log(`discord-poll: Discord answered ${res.status}`);
  process.exit(res.ok ? 0 : 1);
}

// Registers the /gamenight slash command with Discord. Run once (and again if the command changes).
// Needs DISCORD_APP_ID and DISCORD_BOT_TOKEN from the Discord Developer Portal.
import { POLL_COMMAND } from "@/lib/discord/poll";

const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!appId || !token) throw new Error("DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set");

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: { "content-type": "application/json", authorization: `Bot ${token}` },
  body: JSON.stringify([POLL_COMMAND]),
});
if (!res.ok) throw new Error(`Discord answered ${res.status}: ${await res.text()}`);
console.log("discord: registered /gamenight");

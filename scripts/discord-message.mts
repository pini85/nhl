// Posts a plain message to Discord (run from the Actions tab: discord-message). No database needed.
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const content = (process.env.MESSAGE ?? "").replace(/\\n/g, "\n").trim();
if (!webhookUrl || !content) {
  console.log("discord-message: DISCORD_WEBHOOK_URL or the message is missing");
  process.exit(1);
}
const res = await fetch(webhookUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  // No @everyone or player pings.
  body: JSON.stringify({ content: content.slice(0, 2000), allowed_mentions: { parse: [] } }),
});
console.log(`discord-message: Discord answered ${res.status}`);
process.exit(res.ok ? 0 : 1);

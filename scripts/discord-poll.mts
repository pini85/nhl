// Posts the game night poll to Discord. Uses DISCORD_POLL_WEBHOOK_URL if set (a different channel), else DISCORD_WEBHOOK_URL.
import { postGameNightPoll } from "@/lib/discord/poll";

const webhookUrl = process.env.DISCORD_POLL_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL must be set");

await postGameNightPoll(webhookUrl);
console.log("discord: posted the game night poll");

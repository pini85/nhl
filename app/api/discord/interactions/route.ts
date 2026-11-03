import { interactionReply, isFromDiscord } from "@/lib/discord/poll";

// Discord calls this when someone uses the bot's slash command (set as the app's Interactions Endpoint URL).
export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return Response.json({ error: "not configured" }, { status: 500 });

  const body = await request.text();
  const ok = await isFromDiscord(publicKey, request.headers.get("x-signature-ed25519"), request.headers.get("x-signature-timestamp"), body);
  if (!ok) return Response.json({ error: "bad signature" }, { status: 401 });

  return Response.json(interactionReply(JSON.parse(body)));
}

// The game night poll: who can play tonight, and at what time. Posted through the Discord webhook.

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

export async function postGameNightPoll(webhookUrl: string, doFetch: typeof fetch = fetch): Promise<void> {
  const res = await doFetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ poll: gameNightPoll(), allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) throw new Error(`Discord answered ${res.status}: ${await res.text().catch(() => "")}`);
}

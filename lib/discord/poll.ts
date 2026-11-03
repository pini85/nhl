// The /gamenight slash command: Discord sends the command to our site and we answer with a poll.

export const POLL_COMMAND = {
  name: "gamenight",
  description: "Post the game night poll: who can play, and at what time",
  type: 1, // slash command
  contexts: [0], // servers only, not DMs
  integration_types: [0], // installed in a server
};

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

// Interaction and response types from Discord's API.
const PING = 1;
const COMMAND = 2;
const PONG = 1;
const MESSAGE = 4;
const EPHEMERAL = 64;

type Interaction = { type: number; data?: { name?: string } };

/** What to answer Discord with for an interaction it sent us. */
export function interactionReply(interaction: Interaction) {
  if (interaction.type === PING) return { type: PONG };
  if (interaction.type === COMMAND && interaction.data?.name === POLL_COMMAND.name) {
    return { type: MESSAGE, data: { poll: gameNightPoll() } };
  }
  return { type: MESSAGE, data: { content: "I don't know that command.", flags: EPHEMERAL } };
}

const hexBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/** Checks Discord's signature, so only Discord can trigger the bot. */
export async function isFromDiscord(publicKey: string, signature: string | null, timestamp: string | null, body: string): Promise<boolean> {
  if (!signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hexBytes(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexBytes(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

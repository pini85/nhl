import { describe, expect, it } from "vitest";
import { CANT_PLAY, POLL_TIMES, gameNightPoll, interactionReply, isFromDiscord } from "@/lib/discord/poll";

const toHex = (buf: ArrayBuffer) => Buffer.from(buf).toString("hex");

async function signer() {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = toHex(await crypto.subtle.exportKey("raw", keys.publicKey));
  const sign = async (text: string) => toHex(await crypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(text)));
  return { publicKey, sign };
}

describe("gameNightPoll", () => {
  it("has the five times and the can't-play option, one pick, 16 hours", () => {
    const poll = gameNightPoll();
    expect(poll.answers.map((a) => a.poll_media.text)).toEqual([...POLL_TIMES, CANT_PLAY]);
    expect(poll.allow_multiselect).toBe(false);
    expect(poll.duration).toBe(16);
    // Discord's limits: 10 answers, 55 characters each.
    expect(poll.answers.length).toBeLessThanOrEqual(10);
    for (const a of poll.answers) expect(a.poll_media.text.length).toBeLessThanOrEqual(55);
  });
});

describe("interactionReply", () => {
  it("answers Discord's ping", () => {
    expect(interactionReply({ type: 1 })).toEqual({ type: 1 });
  });

  it("answers /gamenight with the poll", () => {
    expect(interactionReply({ type: 2, data: { name: "gamenight" } })).toEqual({ type: 4, data: { poll: gameNightPoll() } });
  });

  it("answers other commands privately", () => {
    expect(interactionReply({ type: 2, data: { name: "other" } })).toMatchObject({ type: 4, data: { flags: 64 } });
  });
});

describe("isFromDiscord", () => {
  it("accepts a signed request and rejects tampered or unsigned ones", async () => {
    const { publicKey, sign } = await signer();
    const body = '{"type":1}';
    const sig = await sign("1700000000" + body);
    expect(await isFromDiscord(publicKey, sig, "1700000000", body)).toBe(true);
    expect(await isFromDiscord(publicKey, sig, "1700000000", '{"type":2}')).toBe(false);
    expect(await isFromDiscord(publicKey, sig, "1700000001", body)).toBe(false);
    expect(await isFromDiscord(publicKey, null, "1700000000", body)).toBe(false);
    expect(await isFromDiscord(publicKey, "zz", "1700000000", body)).toBe(false);
  });
});

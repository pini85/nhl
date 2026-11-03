import { describe, expect, it, vi } from "vitest";
import { CANT_PLAY, POLL_TIMES, gameNightPoll, postGameNightPoll } from "@/lib/discord/poll";

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

describe("postGameNightPoll", () => {
  it("sends the poll to the webhook", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    await postGameNightPoll("https://discord.test/hook", fetch);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://discord.test/hook");
    expect(JSON.parse(init.body as string).poll).toEqual(gameNightPoll());
  });

  it("fails loudly when Discord refuses", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 400 }));
    await expect(postGameNightPoll("https://discord.test/hook", fetch)).rejects.toThrow("400");
  });
});

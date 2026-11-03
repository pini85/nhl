import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { CANT_PLAY, POLL_TIMES, gameNightPoll, postGameNightPoll } from "@/lib/discord/poll";
import { createTestDb } from "../helpers/db";

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
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });
  const now = new Date("2026-11-03T15:00:00Z");
  const ok = () => vi.fn(async () => new Response(null, { status: 204 }));

  it("sends the poll once per day", async () => {
    const fetch = ok();
    const deps = { db, now, webhookUrl: "https://discord.test/hook", fetch };
    expect(await postGameNightPoll(deps)).toMatchObject({ status: "posted" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://discord.test/hook");
    expect(JSON.parse(init.body as string).poll).toEqual(gameNightPoll());

    expect(await postGameNightPoll(deps)).toMatchObject({ status: "already" });
    expect(await postGameNightPoll({ ...deps, now: new Date("2026-11-04T15:00:00Z") })).toMatchObject({ status: "posted" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("lets you try again when Discord fails", async () => {
    const deps = { db, now, webhookUrl: "https://discord.test/hook" };
    expect(await postGameNightPoll({ ...deps, fetch: vi.fn(async () => new Response("nope", { status: 400 })) })).toEqual({ status: "error", detail: "Discord answered 400: nope" });
    expect(await postGameNightPoll({ ...deps, fetch: ok() })).toMatchObject({ status: "posted" });
  });
});

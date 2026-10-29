import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { discordPosts } from "@/db/schema";
import { collect } from "@/lib/collector/collect";
import { postNightRecap } from "@/lib/discord/post";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await collect({ db, ea: createFixtureEa("tests/fixtures/ea/2026-10-23"), now: () => new Date("2026-10-23T12:00:00Z") }, "seed");
});

const now = new Date("2026-10-23T08:30:00Z");
const ok = () => vi.fn(async () => new Response(null, { status: 204 }));

describe("postNightRecap", () => {
  it("posts last night once, with the link and no pings", async () => {
    const fetch = ok();
    const deps = { db, now, webhookUrl: "https://discord.test/hook", siteUrl: "https://site.test", fetch, writeIntro: async () => "Big night." };
    expect(await postNightRecap(deps)).toEqual({ status: "posted", nightKey: "2026-10-22" });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.content).toContain("https://site.test/nights/2026-10-22");
    expect(body.content).toContain("Big night.");
    expect(body.allowed_mentions).toEqual({ parse: [] });

    expect(await postNightRecap(deps)).toEqual({ status: "nothing" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("tries again next run when Discord fails", async () => {
    const fail = vi.fn(async () => new Response("nope", { status: 500 }));
    const deps = { db, now, webhookUrl: "https://discord.test/hook", siteUrl: "https://site.test" };
    expect((await postNightRecap({ ...deps, fetch: fail })).status).toBe("error");
    expect(await db.select().from(discordPosts)).toEqual([]);
    expect((await postNightRecap({ ...deps, fetch: ok() })).status).toBe("posted");
  });
});

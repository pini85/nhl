import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { scoutRequests } from "@/db/schema";
import { watchScouts } from "@/lib/collector/scoutWatch";
import { createTestDb } from "../helpers/db";
import { createFixtureEa } from "../helpers/fixture-ea";

const ea = createFixtureEa("tests/fixtures/ea/2026-10-23");
const now = () => new Date("2026-10-23T12:00:00Z");

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

// A fake clock: each sleep moves time forward instead of waiting.
function fakeTime() {
  let t = 0;
  return { clock: () => t, sleep: async (ms: number) => void (t += ms) };
}

describe("watchScouts", () => {
  it("answers a request that arrives while it waits, then tells the site", async () => {
    const time = fakeTime();
    let changes = 0;
    let polls = 0;
    const r = await watchScouts(
      { db, ea, now },
      {
        durationMs: 30_000,
        intervalMs: 5_000,
        ...time,
        onChange: async () => void changes++,
        onPoll: async () => {
          if (++polls === 2) await db.insert(scoutRequests).values({ query: "Sivudeke", normalized: "sivudeke" });
        },
      },
    );
    expect((await db.select().from(scoutRequests))[0]).toMatchObject({ status: "done", clubId: 17024 });
    expect(r.handled).toBe(1);
    expect(changes).toBe(1);
  });

  it("stops at the deadline and does nothing without requests", async () => {
    const time = fakeTime();
    let changes = 0;
    const r = await watchScouts({ db, ea, now }, { durationMs: 20_000, intervalMs: 5_000, ...time, onChange: async () => void changes++ });
    expect(r.handled).toBe(0);
    expect(changes).toBe(0);
    expect(time.clock()).toBeGreaterThanOrEqual(20_000);
    expect(time.clock()).toBeLessThan(30_000);
  });

  it("keeps watching when a round fails", async () => {
    const time = fakeTime();
    let calls = 0;
    const flaky = { ...ea, searchClubs: async (n: string) => (++calls === 1 ? Promise.reject(new Error("boom")) : ea.searchClubs(n)) };
    await db.insert(scoutRequests).values({ query: "Sivudeke", normalized: "sivudeke" });
    const r = await watchScouts({ db, ea: flaky, now }, { durationMs: 20_000, intervalMs: 5_000, ...time });
    expect(r.errors).toBe(1);
    expect((await db.select().from(scoutRequests))[0].status).toBe("done");
  });
});

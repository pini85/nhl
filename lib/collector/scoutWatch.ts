import type { Db } from "@/db/client";
import { pendingScoutRequests } from "@/db/repo";
import type { EaApi } from "@/lib/ea/api";
import { refreshOpponents } from "@/lib/collector/opponents";

export type WatchOptions = {
  durationMs: number;
  intervalMs: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onChange?: () => Promise<void>; // e.g. tell the website to refresh
  onPoll?: () => Promise<void>; // test hook
};

const MAX_PER_ROUND = 5;

// Runs between collector runs: checks the scout queue every few seconds and answers
// requests right away, so scouting from the lobby takes seconds instead of ~10 minutes.
export async function watchScouts(
  deps: { db: Db; ea: EaApi; now: () => Date },
  opts: WatchOptions,
): Promise<{ handled: number; errors: number }> {
  const clock = opts.clock ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = clock() + opts.durationMs;
  let handled = 0;
  let errors = 0;

  while (clock() < deadline) {
    try {
      await opts.onPoll?.();
      const pending = await pendingScoutRequests(deps.db, MAX_PER_ROUND);
      if (pending.length) {
        // Scout requests only: no budget left over for routine opponent refreshes.
        await refreshOpponents(deps, { budget: pending.length, maxScouts: pending.length, maxMs: 60_000 });
        handled += pending.length;
        await opts.onChange?.();
      }
    } catch {
      errors++;
    }
    await sleep(Math.min(opts.intervalMs, Math.max(0, deadline - clock())));
  }
  return { handled, errors };
}

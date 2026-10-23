import type { RunTrigger } from "@/db/repo";
import { runCollect } from "@/lib/collector/run";

const trigger = (process.env.COLLECT_TRIGGER as RunTrigger | undefined) ?? "manual";
const summary = await runCollect(trigger);
console.log(JSON.stringify(summary, null, 2));

// Tell the website to refresh its cached pages when something new was stored.
const changed = summary.newMatches + summary.recoveredMatches + summary.summaryMatches > 0;
const site = process.env.SITE_URL;
if (changed && site && process.env.CRON_SECRET) {
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    console.log(`revalidate: ${res.ok ? "ok" : res.status}`);
  } catch (e) {
    console.log(`revalidate failed: ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(summary.status === "error" ? 1 : 0);

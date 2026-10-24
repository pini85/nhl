// Runs between collector runs (in place of a plain sleep): answers scout requests within seconds.
import { getDb } from "@/db/client";
import { watchScouts } from "@/lib/collector/scoutWatch";
import { createEaApi } from "@/lib/ea/api";

const seconds = Number(process.env.SCOUT_WATCH_SECONDS ?? 480);
const site = process.env.SITE_URL;
const secret = process.env.CRON_SECRET;

async function revalidate() {
  if (!site || !secret) return;
  try {
    const res = await fetch(`${site}/api/revalidate`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    console.log(`revalidate: ${res.ok ? "ok" : res.status}`);
  } catch (e) {
    console.log(`revalidate failed: ${e instanceof Error ? e.message : e}`);
  }
}

const r = await watchScouts(
  { db: getDb(), ea: createEaApi(), now: () => new Date() },
  { durationMs: seconds * 1000, intervalMs: 4000, onChange: revalidate },
);
console.log(`scout watch: handled ${r.handled}, errors ${r.errors}`);
process.exit(0);

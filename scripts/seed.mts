import { getDb } from "@/db/client";
import { collect } from "@/lib/collector/collect";
import { createFixtureEa } from "../tests/helpers/fixture-ea";

// Imports the games captured on 2026-10-23 (they have since aged out of EA).
const summary = await collect(
  { db: getDb(), ea: createFixtureEa("tests/fixtures/ea/2026-10-23"), now: () => new Date("2026-10-23T12:00:00Z") },
  "seed",
);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.status === "error" ? 1 : 0);

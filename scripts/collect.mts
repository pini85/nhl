import { runCollect } from "@/lib/collector/run";

const summary = await runCollect("manual");
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.status === "error" ? 1 : 0);

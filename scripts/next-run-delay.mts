// Prints how many seconds the collector should wait before starting its next run.
import { msUntilNextRun } from "@/lib/collector/schedule";

console.log(Math.round(msUntilNextRun(new Date()) / 1000));

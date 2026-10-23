import { getDb } from "@/db/client";
import type { RunTrigger } from "@/db/repo";
import { collect, type CollectSummary } from "@/lib/collector/collect";
import { createEaApi } from "@/lib/ea/api";

export function runCollect(trigger: RunTrigger): Promise<CollectSummary> {
  return collect({ db: getDb(), ea: createEaApi() }, trigger);
}

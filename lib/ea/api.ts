import type { z } from "zod";
import { PLATFORM } from "@/lib/config";
import { eaFetch, type EaResult } from "@/lib/ea/http";
import {
  EaMatchListSchema,
  EaSeasonalStatsListSchema,
  type EaMatch,
  type EaSeasonalStats,
} from "@/lib/ea/schemas";

export interface EaApi {
  clubMatches(clubId: number, matchType: string): Promise<EaResult<EaMatch[]>>;
  seasonalStats(clubId: number): Promise<EaResult<EaSeasonalStats>>;
}

function validate<T>(r: EaResult<unknown>, schema: z.ZodType<T>): EaResult<T> {
  if (!r.ok) return r;
  const parsed = schema.safeParse(r.data);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: { kind: "invalid", message: `${issue.path.join(".") || "(root)"}: ${issue.message}` },
  };
}

export function createEaApi(opts: { fetchImpl?: typeof fetch } = {}): EaApi {
  return {
    async clubMatches(clubId, matchType) {
      const r = await eaFetch(
        "clubs/matches",
        { platform: PLATFORM, clubIds: String(clubId), matchType },
        opts,
      );
      return validate(r, EaMatchListSchema) as EaResult<EaMatch[]>;
    },
    async seasonalStats(clubId) {
      const r = await eaFetch("clubs/seasonalStats", { platform: PLATFORM, clubIds: String(clubId) }, opts);
      const list = validate(r, EaSeasonalStatsListSchema);
      return list.ok ? { ok: true, data: list.data[0] as EaSeasonalStats } : list;
    },
  };
}

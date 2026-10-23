import { z } from "zod";
import { PLATFORM } from "@/lib/config";
import { eaFetch, type EaResult } from "@/lib/ea/http";
import { toRosterMember, type RosterMember } from "@/lib/ea/normalize";
import {
  EaMembersSchema,
  EaMatchSchema,
  EaSeasonalStatsListSchema,
  type EaMatch,
  type EaSeasonalStats,
} from "@/lib/ea/schemas";

export interface EaApi {
  clubMatches(clubId: number, matchType: string): Promise<EaResult<EaMatch[]>>;
  seasonalStats(clubId: number): Promise<EaResult<EaSeasonalStats>>;
  members(clubId: number): Promise<EaResult<RosterMember[]>>;
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

function matchIdOf(item: unknown): string | undefined {
  const id = (item as { matchId?: unknown } | null)?.matchId;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}

export function createEaApi(opts: { fetchImpl?: typeof fetch } = {}): EaApi {
  return {
    async clubMatches(clubId, matchType) {
      const r = await eaFetch(
        "clubs/matches",
        { platform: PLATFORM, clubIds: String(clubId), matchType },
        opts,
      );
      // Validate each match separately so one odd game doesn't hide the others.
      const list = validate(r, z.array(z.unknown()));
      if (!list.ok) return list;
      const data: EaMatch[] = [];
      const warnings: string[] = [];
      list.data.forEach((item, i) => {
        const parsed = EaMatchSchema.safeParse(item);
        if (parsed.success) data.push(parsed.data);
        else warnings.push(`invalid-match:${matchIdOf(item) ?? `#${i}`}`);
      });
      return warnings.length ? { ok: true, data, warnings } : { ok: true, data };
    },
    async seasonalStats(clubId) {
      const r = await eaFetch("clubs/seasonalStats", { platform: PLATFORM, clubIds: String(clubId) }, opts);
      const list = validate(r, EaSeasonalStatsListSchema);
      return list.ok ? { ok: true, data: list.data[0] as EaSeasonalStats } : list;
    },
    async members(clubId) {
      const r = await eaFetch("members/stats", { platform: PLATFORM, clubId: String(clubId) }, opts);
      const parsed = validate(r, EaMembersSchema);
      return parsed.ok ? { ok: true, data: parsed.data.members.map(toRosterMember) } : parsed;
    },
  };
}

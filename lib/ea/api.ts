import { z } from "zod";
import { PLATFORM } from "@/lib/config";
import { eaFetch, type EaResult } from "@/lib/ea/http";
import { toInt, toRosterMember, type RosterMember } from "@/lib/ea/normalize";
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
  searchClubs(name: string): Promise<EaResult<ClubSummary[]>>;
  clubInfo(clubId: number): Promise<EaResult<ClubSummary>>;
}

export type ClubSummary = {
  clubId: number;
  name: string;
  crestAssetId: string | null;
  division: number | null;
  wins: number;
  losses: number;
  otl: number;
  seasonResults: string[];
  raw: Record<string, unknown>;
};

type Bag = Record<string, unknown>;

// clubs/search and clubs/seasonalStats share the season fields; clubInfo carries name and crest.
export function toClubSummary(clubId: number, season: Bag, info: Bag | undefined): ClubSummary {
  const kit = (info?.customKit ?? {}) as Bag;
  const division = Number(season.currentDivision);
  return {
    clubId,
    name: String(info?.name ?? season.name ?? `Club ${clubId}`),
    crestAssetId: kit.crestAssetId != null ? String(kit.crestAssetId) : null,
    division: Number.isFinite(division) && division > 0 ? division : null,
    wins: toInt(season.wins),
    losses: toInt(season.losses),
    otl: toInt(season.otl),
    seasonResults: Array.isArray(season.recentResults) ? season.recentResults.map(String) : [],
    raw: { season, info },
  };
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
    async searchClubs(name) {
      const r = await eaFetch("clubs/search", { platform: PLATFORM, clubName: name }, opts);
      if (!r.ok) return r;
      // EA returns an object keyed by clubId, or [] when nothing matches.
      if (Array.isArray(r.data) || r.data === null || typeof r.data !== "object") return { ok: true, data: [] };
      const data = Object.entries(r.data as Record<string, Bag>).map(([id, c]) =>
        toClubSummary(Number(id), c, (c.clubInfo ?? undefined) as Bag | undefined),
      );
      return { ok: true, data };
    },
    async clubInfo(clubId) {
      const season = await this.seasonalStats(clubId);
      if (!season.ok) return season;
      const info = await eaFetch("clubs/info", { platform: PLATFORM, clubIds: String(clubId) }, opts);
      const infoBag = info.ok && info.data && typeof info.data === "object" ? ((info.data as Record<string, Bag>)[String(clubId)] ?? undefined) : undefined;
      return { ok: true, data: toClubSummary(clubId, season.data as Bag, infoBag) };
    },
  };
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { CLUB_ID } from "@/lib/config";
import { toClubSummary, type EaApi } from "@/lib/ea/api";
import { toRosterMember } from "@/lib/ea/normalize";
import { EaMatchListSchema, EaSeasonalStatsListSchema, type EaSeasonalStats } from "@/lib/ea/schemas";

// An EaApi that serves the games captured on 2026-10-23.
// Our club gets its own last 5; any other club gets the recovered games it played in.
export function createFixtureEa(dir: string): EaApi {
  const load = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  const ours = EaMatchListSchema.parse(load("matches-gameType5.json"));
  const recovered = EaMatchListSchema.parse(load("matches-recovered-from-opponents.json"));
  const members = (load("members-stats.json").members as Record<string, unknown>[]).map(toRosterMember);
  const seasonal = EaSeasonalStatsListSchema.parse(load("seasonal-stats.json"))[0] as EaSeasonalStats;

  return {
    async clubMatches(clubId, matchType) {
      if (matchType !== "gameType5") return { ok: true, data: [] };
      if (clubId === CLUB_ID) return { ok: true, data: structuredClone(ours) };
      return {
        ok: true,
        data: structuredClone(recovered.filter((m) => String(clubId) in m.clubs)),
      };
    },
    async seasonalStats() {
      return { ok: true, data: structuredClone(seasonal) };
    },
    async members() {
      return { ok: true, data: structuredClone(members) };
    },
    async searchClubs(name) {
      const hit = [...ours, ...recovered]
        .flatMap((m) => Object.entries(m.clubs))
        .find(([, c]) => String((c.details as { name?: string } | undefined)?.name ?? "").toLowerCase() === name.trim().toLowerCase());
      if (!hit) return { ok: true, data: [] };
      const [id, c] = hit;
      return { ok: true, data: [toClubSummary(Number(id), seasonal, c.details as Record<string, unknown>)] };
    },
    async clubInfo(clubId) {
      const c = [...ours, ...recovered].map((m) => m.clubs[String(clubId)]).find(Boolean);
      return { ok: true, data: toClubSummary(clubId, seasonal, c?.details as Record<string, unknown> | undefined) };
    },
  };
}

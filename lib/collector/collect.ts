import type { Db } from "@/db/client";
import {
  finishRun,
  insertNormalizedMatch,
  insertSnapshot,
  newestStoredPlayedAt,
  startRun,
  type RunTrigger,
} from "@/db/repo";
import { recoverMissing } from "@/lib/collector/recover";
import { CLUB_ID, MATCH_TYPES } from "@/lib/config";
import type { EaApi } from "@/lib/ea/api";
import { normalizeMatch, parseRecentResults, toInt } from "@/lib/ea/normalize";
import type { EaSeasonalStats } from "@/lib/ea/schemas";

export type CollectSummary = {
  runId: number;
  status: "ok" | "partial" | "error";
  newMatches: number;
  recoveredMatches: number;
  summaryMatches: number;
  warnings: string[];
  errors: string[];
};

export type CollectDeps = { db: Db; ea: EaApi; now?: () => Date };

const EA_PAGE_SIZE = 5; // EA only ever returns the last 5 games per type

export async function collect(
  deps: CollectDeps,
  trigger: RunTrigger,
  opts: { recover?: boolean } = {},
): Promise<CollectSummary> {
  const { db, ea } = deps;
  const now = deps.now ?? (() => new Date());
  const runId = await startRun(db, trigger);
  const summary: CollectSummary = {
    runId,
    status: "ok",
    newMatches: 0,
    recoveredMatches: 0,
    summaryMatches: 0,
    warnings: [],
    errors: [],
  };

  try {
    const previousNewest = await newestStoredPlayedAt(db);
    let gapDetected = false;
    let calls = 0;

    for (const type of MATCH_TYPES) {
      calls++;
      const r = await ea.clubMatches(CLUB_ID, type);
      if (!r.ok) {
        summary.errors.push(`matches ${type}: ${r.error.message}`);
        continue;
      }
      summary.warnings.push(...(r.warnings ?? []));
      let newHere = 0;
      for (const raw of r.data) {
        // One game we can't store must not stop the rest of the run.
        try {
          if (await insertNormalizedMatch(db, normalizeMatch(raw, type, CLUB_ID))) newHere++;
        } catch (e) {
          summary.errors.push(`match ${raw.matchId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      summary.newMatches += newHere;

      const oldest = Math.min(...r.data.map((m) => m.timestamp)) * 1000;
      if (
        r.data.length >= EA_PAGE_SIZE &&
        newHere === r.data.length &&
        previousNewest &&
        previousNewest.getTime() < oldest
      ) {
        gapDetected = true;
      }
    }
    if (gapDetected) summary.warnings.push("possible-missed-games");

    calls++;
    const seasonal = await ea.seasonalStats(CLUB_ID);
    // Roster (member/former badges, career stats). Optional: a failure is only a warning.
    const roster = await ea.members(CLUB_ID);
    if (!roster.ok) summary.warnings.push("members-failed");

    if (seasonal.ok) {
      await insertSnapshot(db, { ...snapshotRow(seasonal.data, now()), members: roster.ok ? roster.data : null });
    } else {
      summary.errors.push(`seasonalStats: ${seasonal.error.message}`);
    }

    // Every run: any of EA's last 10 results we don't have yet gets looked for
    // in the opponent's list. Stateless, so a failed attempt is retried next run.
    if ((opts.recover ?? true) && seasonal.ok) {
      const rec = await recoverMissing({ db, ea, now }, parseRecentResults(seasonal.data));
      summary.recoveredMatches = rec.recovered;
      summary.summaryMatches = rec.summaries;
      summary.warnings.push(...rec.warnings);
    }

    summary.status = summary.errors.length === 0 ? "ok" : summary.errors.length >= calls ? "error" : "partial";
  } catch (e) {
    summary.status = "error";
    summary.errors.push(e instanceof Error ? e.message : String(e));
  }

  await finishRun(db, runId, {
    status: summary.status,
    newMatches: summary.newMatches,
    recoveredMatches: summary.recoveredMatches,
    summaryMatches: summary.summaryMatches,
    warnings: summary.warnings,
    error: summary.errors.length ? summary.errors.join("; ") : undefined,
  });
  return summary;
}

function snapshotRow(s: EaSeasonalStats, takenAt: Date) {
  return {
    takenAt,
    clubId: CLUB_ID,
    division: s.currentDivision,
    seasonResults: s.recentResults,
    recentResults: parseRecentResults(s),
    wins: toInt(s.wins),
    losses: toInt(s.losses),
    otl: toInt(s.otl),
    titles: toInt(s.titlesWon),
    promotions: toInt(s.promotions),
    holds: toInt(s.holds),
    relegations: toInt(s.relegations),
    rankingPoints: toInt(s.rankingPoints),
    seasons: toInt(s.seasons),
    raw: s,
  };
}

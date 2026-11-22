// A database-free copy of what EA returns, for when the database is down. EA only keeps each
// club's last 5 games per type, so the collector saves these as GitHub artifacts and
// restoreBackups() loads them into the database once it's back.
import type { Db } from "@/db/client";
import { insertNormalizedMatch, insertSnapshot } from "@/db/repo";
import { snapshotRow } from "@/lib/collector/collect";
import { CLUB_ID, MATCH_TYPES } from "@/lib/config";
import type { EaApi } from "@/lib/ea/api";
import { normalizeMatch, type RosterMember } from "@/lib/ea/normalize";
import { EaMatchSchema, type EaMatch, type EaSeasonalStats } from "@/lib/ea/schemas";

export type EaBackup = {
  takenAt: string;
  matches: Record<string, EaMatch[]>;
  seasonal: EaSeasonalStats | null;
  members: RosterMember[] | null;
  errors: string[];
};

/** Fetches our games, season stats and roster from EA. Never touches the database. */
export async function takeBackup(ea: EaApi, now = new Date()): Promise<EaBackup> {
  const backup: EaBackup = { takenAt: now.toISOString(), matches: {}, seasonal: null, members: null, errors: [] };
  for (const type of MATCH_TYPES) {
    const r = await ea.clubMatches(CLUB_ID, type);
    if (r.ok) backup.matches[type] = r.data;
    else backup.errors.push(`matches ${type}: ${r.error.message}`);
  }
  const seasonal = await ea.seasonalStats(CLUB_ID);
  if (seasonal.ok) backup.seasonal = seasonal.data;
  else backup.errors.push(`seasonalStats: ${seasonal.error.message}`);
  const members = await ea.members(CLUB_ID);
  if (members.ok) backup.members = members.data;
  return backup;
}

export type RestoreSummary = { files: number; newMatches: number; snapshots: number; errors: string[] };

/** Loads backups into the database, oldest first. Safe to run twice: stored games are skipped. */
export async function restoreBackups(db: Db, backups: EaBackup[]): Promise<RestoreSummary> {
  const summary: RestoreSummary = { files: backups.length, newMatches: 0, snapshots: 0, errors: [] };
  const sorted = [...backups].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const seen = new Set<string>();
  for (const b of sorted) {
    for (const [type, list] of Object.entries(b.matches)) {
      for (const raw of list) {
        try {
          const match = EaMatchSchema.parse(raw);
          if (seen.has(match.matchId)) continue;
          seen.add(match.matchId);
          if (await insertNormalizedMatch(db, normalizeMatch(match, type, CLUB_ID))) summary.newMatches++;
        } catch (e) {
          summary.errors.push(`match ${(raw as { matchId?: unknown }).matchId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  // Keep the season standings history: one snapshot per backup that has stats.
  for (const b of sorted) {
    if (!b.seasonal) continue;
    try {
      await insertSnapshot(db, { ...snapshotRow(b.seasonal, new Date(b.takenAt)), members: b.members });
      summary.snapshots++;
    } catch (e) {
      summary.errors.push(`snapshot ${b.takenAt}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return summary;
}

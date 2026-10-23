import type { Db } from "@/db/client";
import {
  insertOpponentSnapshot,
  knownClubName,
  markScoutRequest,
  pendingScoutRequests,
  staleRecentOpponents,
} from "@/db/repo";
import type { ClubSummary, EaApi } from "@/lib/ea/api";
import { buildProfile } from "@/lib/opponents/profile";

const SEASON_TYPE = "gameType5";

// Keeps opponent snapshots fresh (Vercel can't call EA, so the collector does it).
// Scout requests go first, then recent opponents; at most `budget` clubs per run.
export async function refreshOpponents(
  deps: { db: Db; ea: EaApi; now: () => Date },
  budget = 6,
): Promise<{ refreshed: number; warnings: string[] }> {
  const { db, ea, now } = deps;
  const warnings: string[] = [];
  let refreshed = 0;
  let used = 0;

  for (const req of await pendingScoutRequests(db, budget)) {
    used++;
    const r = await ea.searchClubs(req.query);
    if (!r.ok) {
      warnings.push(`scout-failed:${req.id}`);
      continue;
    }
    const q = req.normalized;
    const hit = r.data.find((c) => c.name.trim().toLowerCase() === q) ?? r.data[0];
    if (!hit) {
      await markScoutRequest(db, req.id, "not_found");
      continue;
    }
    if (await refreshClub(deps, hit.clubId, hit, warnings)) refreshed++;
    await markScoutRequest(db, req.id, "done", hit.clubId);
  }

  for (const clubId of await staleRecentOpponents(db, now(), budget - used)) {
    if (await refreshClub(deps, clubId, null, warnings)) refreshed++;
  }
  return { refreshed, warnings };
}

async function refreshClub(
  { db, ea, now }: { db: Db; ea: EaApi; now: () => Date },
  clubId: number,
  known: ClubSummary | null,
  warnings: string[],
): Promise<boolean> {
  const info = known ? { ok: true as const, data: known } : await ea.clubInfo(clubId);
  const members = await ea.members(clubId);
  const recent = await ea.clubMatches(clubId, SEASON_TYPE);
  if (!info.ok && !members.ok && !recent.ok) {
    warnings.push(`opponent-failed:${clubId}`);
    return false;
  }
  const summary = info.ok ? info.data : null;
  await insertOpponentSnapshot(db, {
    clubId,
    takenAt: now(),
    name: summary?.name ?? (await knownClubName(db, clubId)) ?? `Club ${clubId}`,
    crestAssetId: summary?.crestAssetId ?? null,
    division: summary?.division ?? null,
    wins: summary?.wins ?? 0,
    losses: summary?.losses ?? 0,
    otl: summary?.otl ?? 0,
    seasonResults: summary?.seasonResults ?? [],
    members: members.ok ? members.data : null,
    profile: recent.ok ? buildProfile(recent.data, clubId) : null,
    raw: { info: summary?.raw ?? null },
  });
  return true;
}

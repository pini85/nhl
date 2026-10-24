import type { Db } from "@/db/client";
import {
  bumpScoutAttempt,
  clubsWithSnapshots,
  insertOpponentSnapshot,
  knownClubName,
  markScoutRequest,
  pendingScoutRequests,
  pruneOpponentSnapshots,
  staleRecentOpponents,
} from "@/db/repo";
import type { ClubSummary, EaApi } from "@/lib/ea/api";
import { buildProfile } from "@/lib/opponents/profile";

const SEASON_TYPE = "gameType5";
const MAX_SCOUT_ATTEMPTS = 3;
const MAX_CONSECUTIVE_FAILURES = 2;
const MAX_EXTRA_RESULTS = 10; // other clubs from one search saved for local search

export type RefreshOptions = {
  budget?: number; // clubs per run
  maxScouts?: number; // scout requests per run, so recent opponents always get the rest
  maxMs?: number; // time budget for the whole phase
  clock?: () => number;
};

// Keeps opponent snapshots fresh (Vercel can't call EA, so the collector does it).
// Bounded by club count, scout share, time and consecutive failures, so a slow or
// failing EA can never push the collector past its GitHub job limit.
export async function refreshOpponents(
  deps: { db: Db; ea: EaApi; now: () => Date },
  opts: RefreshOptions = {},
): Promise<{ refreshed: number; warnings: string[] }> {
  const { db, ea } = deps;
  const { budget = 6, maxScouts = 2, maxMs = 120_000, clock = Date.now } = opts;
  const warnings: string[] = [];
  const start = clock();
  let refreshed = 0;
  let used = 0;
  let failuresInARow = 0;

  const canContinue = () => {
    if (failuresInARow >= MAX_CONSECUTIVE_FAILURES) {
      if (!warnings.includes("opponents-ea-failing")) warnings.push("opponents-ea-failing");
      return false;
    }
    if (clock() - start > maxMs) {
      if (!warnings.includes("opponents-time-budget")) warnings.push("opponents-time-budget");
      return false;
    }
    return used < budget;
  };
  const track = (ok: boolean) => {
    failuresInARow = ok ? 0 : failuresInARow + 1;
    if (ok) refreshed++;
  };

  for (const req of await pendingScoutRequests(db, Math.min(maxScouts, budget))) {
    if (!canContinue()) break;
    used++;
    if (req.clubId) {
      const ok = await refreshClub(deps, req.clubId, null, warnings);
      track(ok);
      if (ok) await markScoutRequest(db, req.id, "done", req.clubId);
      else await failAttempt(db, req.id);
      continue;
    }
    const r = await ea.searchClubs(req.query);
    if (!r.ok) {
      warnings.push(`scout-failed:${req.id}`);
      failuresInARow++;
      await failAttempt(db, req.id);
      continue;
    }
    const hit = r.data.find((c) => c.name.trim().toLowerCase() === req.normalized) ?? r.data[0];
    if (!hit) {
      await markScoutRequest(db, req.id, "not_found");
      continue;
    }
    track(await refreshClub(deps, hit.clubId, hit, warnings));
    await saveOtherResults(deps, r.data.filter((c) => c.clubId !== hit.clubId));
    await markScoutRequest(db, req.id, "done", hit.clubId, r.data.length);
  }

  for (const clubId of await staleRecentOpponents(db, deps.now(), budget - used)) {
    if (!canContinue()) break;
    used++;
    track(await refreshClub(deps, clubId, null, warnings));
  }
  return { refreshed, warnings };
}

// The search already returned name, crest, division and record for every club, so saving
// the rest costs no EA calls. Clubs we already know keep their fuller snapshot.
async function saveOtherResults({ db, now }: { db: Db; now: () => Date }, clubs: ClubSummary[]) {
  const list = clubs.slice(0, MAX_EXTRA_RESULTS);
  const known = await clubsWithSnapshots(db, list.map((c) => c.clubId));
  for (const c of list) {
    if (known.has(c.clubId)) continue;
    await insertOpponentSnapshot(db, {
      clubId: c.clubId,
      takenAt: now(),
      name: c.name,
      crestAssetId: c.crestAssetId,
      division: c.division,
      wins: c.wins,
      losses: c.losses,
      otl: c.otl,
      seasonResults: c.seasonResults,
      members: null,
      profile: null,
      raw: { info: c.raw },
    });
  }
}

async function failAttempt(db: Db, id: number) {
  if ((await bumpScoutAttempt(db, id)) >= MAX_SCOUT_ATTEMPTS) await markScoutRequest(db, id, "error");
}

async function refreshClub(
  { db, ea, now }: { db: Db; ea: EaApi; now: () => Date },
  clubId: number,
  known: ClubSummary | null,
  warnings: string[],
): Promise<boolean> {
  const info = known ? { ok: true as const, data: known } : await ea.clubInfo(clubId);
  if (!info.ok) {
    // Without basic club info the other calls are likely to fail too; stop early.
    warnings.push(`opponent-failed:${clubId}`);
    return false;
  }
  const members = await ea.members(clubId);
  const recent = await ea.clubMatches(clubId, SEASON_TYPE);
  const summary = info.data;
  await insertOpponentSnapshot(db, {
    clubId,
    takenAt: now(),
    name: summary.name || (await knownClubName(db, clubId)) || `Club ${clubId}`,
    crestAssetId: summary.crestAssetId,
    division: summary.division,
    wins: summary.wins,
    losses: summary.losses,
    otl: summary.otl,
    seasonResults: summary.seasonResults,
    members: members.ok ? members.data : null,
    profile: recent.ok ? buildProfile(recent.data, clubId) : null,
    raw: { info: summary.raw },
  });
  await pruneOpponentSnapshots(db, clubId);
  return true;
}

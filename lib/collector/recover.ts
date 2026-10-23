import type { Db } from "@/db/client";
import { insertMatchRow, insertNormalizedMatch, recentStoredResults } from "@/db/repo";
import { CLUB_ID, MATCH_TYPES } from "@/lib/config";
import type { EaApi } from "@/lib/ea/api";
import { normalizeMatch, type RecentResult } from "@/lib/ea/normalize";

type ScoreKey = { opponentClubId: number; goalsFor: number; goalsAgainst: number };
const keyOf = (x: ScoreKey) => `${x.opponentClubId}|${x.goalsFor}|${x.goalsAgainst}`;

// How many recent results have no stored game with the same opponent and score.
// Treated as a multiset; the oldest entries of a key are the uncovered ones.
export function findUncovered(recent: RecentResult[], stored: ScoreKey[]): RecentResult[] {
  const available = new Map<string, number>();
  for (const s of stored) available.set(keyOf(s), (available.get(keyOf(s)) ?? 0) + 1);

  const uncovered: RecentResult[] = [];
  for (const entry of [...recent].sort((a, b) => a.index - b.index)) {
    const left = available.get(keyOf(entry)) ?? 0;
    if (left > 0) available.set(keyOf(entry), left - 1);
    else uncovered.push(entry);
  }
  return uncovered;
}

const STORED_WINDOW = 30;

export async function recoverMissing(
  deps: { db: Db; ea: EaApi; now: () => Date },
  recent: RecentResult[],
): Promise<{ recovered: number; summaries: number; warnings: string[] }> {
  const { db, ea, now } = deps;
  const warnings: string[] = [];
  let recovered = 0;

  const initiallyUncovered = findUncovered(recent, await recentStoredResults(db, STORED_WINDOW));
  if (!initiallyUncovered.length) return { recovered: 0, summaries: 0, warnings };

  // A game is in both clubs' lists, so it may still be in the opponent's last 5.
  const opponents = [...new Set(initiallyUncovered.map((e) => e.opponentClubId))];
  for (const opponentId of opponents) {
    let failed = false;
    for (const type of MATCH_TYPES) {
      const r = await ea.clubMatches(opponentId, type);
      if (!r.ok) {
        failed = true;
        continue;
      }
      for (const raw of r.data) {
        if (!(String(CLUB_ID) in raw.clubs)) continue;
        if (await insertNormalizedMatch(db, normalizeMatch(raw, type, CLUB_ID))) recovered++;
      }
    }
    if (failed) warnings.push(`recover-failed:${opponentId}`);
  }

  // Whatever is still missing becomes a score-only game.
  const stored = await recentStoredResults(db, STORED_WINDOW);
  const playedAtByKey = new Map<string, Date>();
  for (const s of [...stored].reverse()) playedAtByKey.set(keyOf(s), s.playedAt); // newest wins

  const byIndex = new Map(recent.map((e) => [e.index, e]));
  const runSeconds = Math.floor(now().getTime() / 1000);
  let summaries = 0;

  for (const entry of findUncovered(recent, stored)) {
    const newer = [...byIndex.values()]
      .filter((e) => e.index < entry.index)
      .sort((a, b) => b.index - a.index)[0];
    const neighbourAt = newer ? playedAtByKey.get(keyOf(newer)) : undefined;
    const playedAt = neighbourAt ? new Date(neighbourAt.getTime() - 1000) : now();

    const inserted = await insertMatchRow(db, {
      matchId: `summary-${entry.opponentClubId}-${runSeconds}-${entry.index}`,
      playedAt,
      matchType: "gameType5",
      source: "summary",
      opponentClubId: entry.opponentClubId,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      outcome: entry.outcome,
      overtime: false,
      dnf: "none",
      resultCode: null,
      timestampEstimated: true,
      raw: null,
    });
    if (inserted) {
      summaries++;
      playedAtByKey.set(keyOf(entry), playedAt);
    }
  }
  if (summaries) warnings.push(`summary-only:${summaries}`);

  return { recovered, summaries, warnings };
}

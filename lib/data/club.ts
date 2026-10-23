import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { CLUB_TAG } from "@/lib/config";
import { allGames, latestSnapshot, matchDetail, ourPlayerLines, playerDetail, snapshotHistory } from "@/lib/queries/club";

// Cached reads for pages. Refreshed by /api/revalidate (collector) and every 5 minutes.

export async function getSnapshot() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return latestSnapshot(getDb());
}

export async function getGames() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return allGames(getDb());
}

export async function getOurLines() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return ourPlayerLines(getDb());
}

export async function getMatch(matchId: string) {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return matchDetail(getDb(), matchId);
}

export async function getPlayer(eaPlayerId: string) {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return playerDetail(getDb(), eaPlayerId);
}

export async function getSnapshotHistory() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return snapshotHistory(getDb());
}

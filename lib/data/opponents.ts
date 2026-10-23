import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { CLUB_TAG } from "@/lib/config";
import { allClubRows, latestOpponentSnapshot, opponentLines, recentScoutRequests, scoutedClubs } from "@/lib/queries/opponents";

export async function getOpponentSnapshot(clubId: number) {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return latestOpponentSnapshot(getDb(), clubId);
}

export async function getScoutedClubs() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return scoutedClubs(getDb());
}

export async function getClubRows() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return allClubRows(getDb());
}

export async function getOpponentLines(clubId: number) {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return opponentLines(getDb(), clubId);
}

export async function getRecentScoutRequests() {
  "use cache";
  cacheTag(CLUB_TAG);
  cacheLife("club");
  return recentScoutRequests(getDb(), 6);
}

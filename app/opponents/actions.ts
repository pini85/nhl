"use server";

import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { startScoutRun } from "@/lib/github/dispatch";
import { CLUB_TAG } from "@/lib/config";
import { createScoutRequest, deleteScoutRequest, scoutRequestStatus } from "@/lib/queries/opponents";

export type ScoutStatus = "created" | "exists" | "invalid" | "busy" | "error";

// Queues a club to fetch from EA and starts the GitHub scout run to answer it now.
// If that can't be started, the next collector run answers it.
export async function requestScout(query: string, clubId?: number): Promise<{ status: ScoutStatus }> {
  try {
    const status = await createScoutRequest(getDb(), String(query ?? ""), clubId);
    if (status === "created") await startScoutRun();
    return { status };
  } catch {
    return { status: "error" };
  }
}

// Removes a request from "Recent scout requests" (cancels it if still waiting).
export async function removeScoutRequest(id: number): Promise<{ ok: boolean }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  try {
    const ok = await deleteScoutRequest(getDb(), id);
    updateTag(CLUB_TAG);
    return { ok };
  } catch {
    return { ok: false };
  }
}

// Polled by the search box while a scout request is being answered.
export async function checkScout(query: string) {
  try {
    const row = await scoutRequestStatus(getDb(), String(query ?? "").slice(0, 80));
    if (row && row.status !== "pending") updateTag(CLUB_TAG); // so the refreshed page lists the new clubs
    return row;
  } catch {
    return null;
  }
}

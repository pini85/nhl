"use server";

import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { CLUB_TAG } from "@/lib/config";
import { createScoutRequest, deleteScoutRequest, scoutRequestStatus } from "@/lib/queries/opponents";

export type ScoutStatus = "created" | "exists" | "invalid" | "busy" | "error";

// Queues a club for the GitHub collector to fetch from EA on its next run.
export async function requestScout(query: string, clubId?: number): Promise<{ status: ScoutStatus }> {
  try {
    return { status: await createScoutRequest(getDb(), String(query ?? ""), clubId) };
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

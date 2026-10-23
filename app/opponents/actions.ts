"use server";

import { getDb } from "@/db/client";
import { createScoutRequest } from "@/lib/queries/opponents";

export type ScoutStatus = "created" | "exists" | "invalid" | "busy" | "error";

// Queues a club for the GitHub collector to fetch from EA on its next run.
export async function requestScout(query: string, clubId?: number): Promise<{ status: ScoutStatus }> {
  try {
    return { status: await createScoutRequest(getDb(), String(query ?? ""), clubId) };
  } catch {
    return { status: "error" };
  }
}

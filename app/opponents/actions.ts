"use server";

import { getDb } from "@/db/client";
import { createScoutRequest } from "@/lib/queries/opponents";

// Queues a club for the GitHub collector to fetch from EA on its next run.
export async function requestScout(query: string): Promise<{ status: "created" | "exists" | "invalid" }> {
  return { status: await createScoutRequest(getDb(), String(query ?? "")) };
}

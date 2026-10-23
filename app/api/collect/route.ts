import { revalidateTag } from "next/cache";
import { runCollect } from "@/lib/collector/run";
import { CLUB_TAG } from "@/lib/config";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runCollect("cron");
  if (summary.newMatches + summary.recoveredMatches + summary.summaryMatches + (summary.opponentsRefreshed ?? 0) > 0) {
    revalidateTag(CLUB_TAG, "max");
  }
  return Response.json(summary);
}

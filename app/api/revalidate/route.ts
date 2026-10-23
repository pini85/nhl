import { revalidateTag } from "next/cache";
import { CLUB_TAG } from "@/lib/config";

// Called by the GitHub collector after it stores new games.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // Expire immediately so the next visitor sees the new game, not a stale page.
  revalidateTag(CLUB_TAG, { expire: 0 });
  return Response.json({ ok: true });
}

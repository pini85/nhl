import { CLUB_ID, PLATFORM } from "@/lib/config";
import { eaFetch } from "@/lib/ea/http";

// Phase 0 check: can this deployment reach EA's API?
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const r = await eaFetch("clubs/info", { platform: PLATFORM, clubIds: String(CLUB_ID) });
  return Response.json({
    ok: r.ok,
    status: r.ok ? 200 : (r.error.status ?? null),
    error: r.ok ? null : r.error.message,
    ms: Date.now() - started,
    region: process.env.VERCEL_REGION ?? null,
  });
}

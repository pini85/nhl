// Lists which EA match types hold our club's recent games (read-only).
import { CLUB_ID, PLATFORM } from "@/lib/config";
import { eaFetch } from "@/lib/ea/http";

const types = [
  ...Array.from({ length: 30 }, (_, i) => `gameType${i + 1}`),
  "club_private", "club_finals", "clubFinals", "club_playoffs", "playoffs", "finals", "club_public",
];
for (const t of types) {
  const r = await eaFetch("clubs/matches", { platform: PLATFORM, clubIds: String(CLUB_ID), matchType: t });
  if (!r.ok) console.log(t.padEnd(16), "error", r.error.message);
  else if (Array.isArray(r.data)) {
    const ts = r.data.map((m: { timestamp: number }) => m.timestamp);
    console.log(t.padEnd(16), `${r.data.length} games`, ts.length ? `newest ${new Date(Math.max(...ts) * 1000).toISOString()}` : "");
  } else console.log(t.padEnd(16), "not a list:", JSON.stringify(r.data).slice(0, 80));
  await new Promise((res) => setTimeout(res, 300));
}

import { getSnapshot } from "@/lib/data/club";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { seasonProgress } from "@/lib/stats/season";

export const alt = "Drop drop drop club stats";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const snap = await getSnapshot().catch(() => null);
  if (!snap) return ogCard({ eyebrow: "NHL 27 Pro Club", big: "DDD", title: "Drop drop drop", subtitle: "Club-only stats, game nights and scouting" });
  const s = seasonProgress(snap.seasonResults, snap.division);
  return ogCard({
    eyebrow: `Division ${snap.division} · ${snap.wins}-${snap.losses}-${snap.otl} all-time`,
    big: `${s.points} pts`,
    bigColor: "#5cc8ff",
    title: "Drop drop drop",
    subtitle: s.outlook || "Club-only stats, game nights and scouting",
  });
}

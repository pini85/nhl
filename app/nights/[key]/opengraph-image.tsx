import { CLUB_ID } from "@/lib/config";
import { getGames, getOurLines } from "@/lib/data/club";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { nightRecap } from "@/lib/stats/nightRecap";

export const alt = "Game night recap";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [games, lines] = await Promise.all([getGames().catch(() => []), getOurLines().catch(() => [])]);
  const r = nightRecap(key, games, lines, CLUB_ID);
  if (!r) return ogCard({ eyebrow: "Game night", big: "DDD", title: "Drop drop drop" });
  return ogCard({
    eyebrow: `Game night · ${r.night.label}`,
    big: `${r.night.wins}–${r.night.losses}`,
    title: `${r.night.games.length} games · GF ${r.night.goalsFor} · GA ${r.night.goalsAgainst}`,
    subtitle: r.mvp && r.mvp.points > 0 ? `⭐ MVP ${r.mvp.playerName} · ${r.mvp.goals}G ${r.mvp.assists}A` : undefined,
  });
}

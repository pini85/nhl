import { CLUB_ID } from "@/lib/config";
import { getMatch } from "@/lib/data/club";
import { ogCard, ogDay, OG_SIZE } from "@/lib/og/card";
import { threeStars } from "@/lib/stats/nights";

export const alt = "Game recap";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const detail = await getMatch(matchId).catch(() => null);
  if (!detail) return ogCard({ eyebrow: "Game recap", big: "DDD", title: "Drop drop drop" });
  const { game, lines } = detail;
  const star = threeStars(lines, CLUB_ID)[0];
  return ogCard({
    eyebrow: `${game.outcome === "W" ? "Win" : "Loss"}${game.overtime ? " (OT)" : ""} · ${ogDay.format(game.playedAt)}`,
    big: `${game.goalsFor}–${game.goalsAgainst}`,
    bigColor: game.outcome === "W" ? "#5dffa8" : game.overtime ? "#ffd27a" : "#ff7a8a",
    title: `vs ${game.opponentName ?? `Club ${game.opponentClubId}`}`,
    subtitle: star ? `⭐ ${star.playerName} · ${star.goals}G ${star.assists}A` : undefined,
  });
}

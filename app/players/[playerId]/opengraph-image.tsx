import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getPlayer } from "@/lib/data/club";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { playerTotals } from "@/lib/stats/players";
import { playerCard } from "@/lib/stats/cards";

export const alt = "Player card";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const [detail, extras] = await Promise.all([getPlayer(playerId).catch(() => null), getExtraStats().catch(() => [])]);
  if (!detail) return ogCard({ eyebrow: "Player", big: "DDD", title: "Drop drop drop" });
  const mine = extras.filter((e) => e.eaPlayerId === playerId);
  const { skaters, goalies } = playerTotals(detail.lines, detail.games, null, CLUB_ID, mine);
  const sk = skaters[0];
  const gl = goalies[0];
  const card = playerCard(detail.lines, detail.games, playerId);
  if (sk) {
    return ogCard({
      eyebrow: `${card ? `OVR ${card.ovr} · ` : ""}${sk.gp} games for Drop drop drop`,
      big: `${sk.points} pts`,
      bigColor: "#5cc8ff",
      title: sk.name,
      subtitle: `${sk.goals}G · ${sk.assists}A · ${sk.plusMinus > 0 ? "+" : ""}${sk.plusMinus} · ${sk.pointsPerGame.toFixed(2)} P/GP`,
    });
  }
  return ogCard({
    eyebrow: `${gl.gp} games in net`,
    big: gl.savePct.toFixed(3).replace(/^0/, ""),
    bigColor: "#5cc8ff",
    title: gl.name,
    subtitle: `${gl.saves} saves · ${gl.gaa.toFixed(2)} GAA`,
  });
}

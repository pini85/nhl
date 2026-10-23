import { CLUB_ID } from "@/lib/config";
import { getPlayer } from "@/lib/data/club";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { playerTotals } from "@/lib/stats/players";

export const alt = "Player card";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const detail = await getPlayer(playerId).catch(() => null);
  if (!detail) return ogCard({ eyebrow: "Player", big: "DDD", title: "Drop drop drop" });
  const { skaters, goalies } = playerTotals(detail.lines, detail.games, null, CLUB_ID);
  const sk = skaters[0];
  const gl = goalies[0];
  if (sk) {
    return ogCard({
      eyebrow: `${sk.gp} games for Drop drop drop`,
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

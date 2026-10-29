import { NightTrendChart } from "@/components/charts/NightTrendChart";
import { getOurLines } from "@/lib/data/club";
import { getMe } from "@/lib/me-server";
import type { GameNight } from "@/lib/stats/nights";
import { nightSeries } from "@/lib/stats/trends";

/** Goals per game night, plus the viewer's own goals when they've picked who they are. */
export async function NightTrend({ nights }: { nights: GameNight[] }) {
  const [{ me }, lines] = await Promise.all([getMe(), getOurLines()]);
  const mine = me.kind === "player" ? { lines, playerId: me.playerId } : undefined;
  return <NightTrendChart data={nightSeries(nights, 12, mine)} />;
}

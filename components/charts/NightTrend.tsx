import { MeVsMatesChart } from "@/components/charts/MeVsMatesChart";
import { NightTrendChart } from "@/components/charts/NightTrendChart";
import { getOurLines } from "@/lib/data/club";
import { getMe } from "@/lib/me-server";
import type { GameNight } from "@/lib/stats/nights";
import { nightSeries, nightTeammates } from "@/lib/stats/trends";

/** Goals per game night, plus "You vs teammates" when the viewer has picked who they are. */
export async function NightTrend({ nights }: { nights: GameNight[] }) {
  const [{ me }, lines] = await Promise.all([getMe(), getOurLines()]);
  const mine = me.kind === "player" ? { lines, playerId: me.playerId } : undefined;
  const data = nightSeries(nights, 12, mine);
  return (
    <>
      <NightTrendChart data={data} />
      {mine && (
        <MeVsMatesChart
          data={data}
          teammates={nightTeammates(nights, lines, mine.playerId)}
          myName={lines.findLast((l) => l.eaPlayerId === mine.playerId)?.playerName ?? "You"}
          myRole={nightTeammates(nights, lines.filter((l) => l.eaPlayerId === mine.playerId), "").at(0)?.role ?? "all"}
        />
      )}
    </>
  );
}

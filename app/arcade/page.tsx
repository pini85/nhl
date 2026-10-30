import { ArcadeView } from "@/components/arcade/ArcadeView";
import { EmptyState } from "@/components/club/Section";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOpponentLinesInOurGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { arcadeData } from "@/lib/stats/arcade";

export const metadata = { title: "Arcade", description: "Revenge Tour: 3-on-3 arcade hockey with our real players against the clubs that beat us." };

export default async function ArcadePage() {
  const [games, lines, snapshot, extras, oppLines] = await Promise.all([getGames(), getOurLines(), getSnapshot(), getExtraStats(), getOpponentLinesInOurGames()]);
  const data = arcadeData(lines, games, snapshot?.members ?? null, CLUB_ID, extras, oppLines);
  if (!games.length || data.skaters.length === 0) return <EmptyState title="The rink is still being flooded" hint="The arcade opens once games are saved." />;
  return <ArcadeView data={data} />;
}

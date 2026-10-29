import { EmptyState } from "@/components/club/Section";
import { GalaxyView } from "@/components/galaxy/GalaxyView";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { galaxyData } from "@/lib/stats/galaxy";

export const metadata = { title: "Galaxy", description: "Every game, every teammate and the leaders, in 3D." };

export default async function GalaxyPage() {
  const [games, lines, snapshot, extras] = await Promise.all([getGames(), getOurLines(), getSnapshot(), getExtraStats()]);
  if (!games.length) return <EmptyState title="The galaxy is empty" hint="Stars appear once games are saved." />;
  return <GalaxyView data={galaxyData(lines, games, snapshot?.members ?? null, CLUB_ID, extras)} />;
}

import { EmptyState } from "@/components/club/Section";
import { WrappedStory } from "@/components/club/WrappedStory";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines } from "@/lib/data/club";
import { getClubRows } from "@/lib/data/opponents";
import { buildWrapped } from "@/lib/stats/wrapped";

export const metadata = { title: "All-time Wrapped" };

export default async function WrappedPage() {
  const [games, lines, clubs, extras] = await Promise.all([getGames(), getOurLines(), getClubRows(), getExtraStats()]);
  const { slides } = buildWrapped(games, lines, clubs, CLUB_ID, extras);
  if (!slides.length) return <EmptyState title="Wrapped unlocks after your first games" />;
  return <WrappedStory slides={slides} />;
}

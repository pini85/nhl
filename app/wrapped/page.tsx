import { EmptyState } from "@/components/club/Section";
import { WrappedStory } from "@/components/club/WrappedStory";
import { CLUB_ID } from "@/lib/config";
import { getGames, getOurLines } from "@/lib/data/club";
import { getClubRows } from "@/lib/data/opponents";
import { buildWrapped } from "@/lib/stats/wrapped";

export const metadata = { title: "Wrapped" };

export default async function WrappedPage() {
  const [games, lines, clubs] = await Promise.all([getGames(), getOurLines(), getClubRows()]);
  const { slides } = buildWrapped(games, lines, clubs, CLUB_ID);
  if (!slides.length) return <EmptyState title="Wrapped unlocks after your first games" />;
  return <WrappedStory slides={slides} />;
}

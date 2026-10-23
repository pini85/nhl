import { GamesBrowser } from "@/components/club/GamesBrowser";
import { EmptyState } from "@/components/club/Section";
import { CLUB_ID } from "@/lib/config";
import { getGames, getOurLines } from "@/lib/data/club";
import { groupGameNights, nightMvp } from "@/lib/stats/nights";

export const metadata = { title: "Games" };

export default async function GamesPage() {
  const [games, lines] = await Promise.all([getGames(), getOurLines()]);
  const nights = groupGameNights(games).map((n) => {
    const ids = new Set(n.games.map((g) => g.matchId));
    const mvp = nightMvp(lines.filter((l) => ids.has(l.matchId)), CLUB_ID);
    return { ...n, mvp: mvp && { playerName: mvp.playerName, points: mvp.points } };
  });
  const w = games.filter((g) => g.outcome === "W").length;

  return (
    <>
      <h1 className="text-2xl font-black">Games</h1>
      <p className="text-xs text-[var(--muted-fg)]">
        {games.length} saved · {w}-{games.length - w} · grouped by game night (CET)
      </p>
      {nights.length ? <GamesBrowser nights={nights} /> : <EmptyState title="No games saved yet" />}
    </>
  );
}

import { NemesisCards } from "@/components/club/NemesisCards";
import { OpponentsBrowser } from "@/components/club/OpponentsBrowser";
import { getGames } from "@/lib/data/club";
import { getClubRows, getScoutedClubs } from "@/lib/data/opponents";
import { crestMap, opponentDirectory } from "@/lib/opponents/directory";
import { headToHead, nemesis, punchingBags } from "@/lib/stats/opponents";

export const metadata = { title: "Opponents" };

export default async function OpponentsPage() {
  const [games, clubRows, scouted] = await Promise.all([getGames(), getClubRows(), getScoutedClubs()]);
  const h2h = headToHead(games);
  const crests = crestMap(clubRows, scouted);
  const clubs = opponentDirectory(h2h, scouted, crests);

  return (
    <>
      <h1 className="text-2xl font-black">Opponents</h1>
      <p className="text-xs text-[var(--muted-fg)]">
        {h2h.length} clubs played · search before a game to scout them
      </p>
      <OpponentsBrowser clubs={clubs}>
        <NemesisCards nemesis={nemesis(h2h)} bags={punchingBags(h2h)} crests={crests} />
      </OpponentsBrowser>
    </>
  );
}

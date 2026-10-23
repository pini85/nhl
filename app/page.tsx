import { Crest } from "@/components/club/Crest";
import { FadeIn } from "@/components/club/FadeIn";
import { HotPlayers } from "@/components/club/HotPlayers";
import { LatestNight } from "@/components/club/LatestNight";
import { SeasonCard } from "@/components/club/SeasonCard";
import { EmptyState } from "@/components/club/Section";
import { TrophyCase } from "@/components/club/TrophyCase";
import { CLUB_CREST_ASSET, CLUB_ID, CLUB_NAME } from "@/lib/config";
import { getGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { groupGameNights, nightMvp } from "@/lib/stats/nights";
import { hotPlayers } from "@/lib/stats/players";
import { seasonProgress } from "@/lib/stats/season";

export default async function Home() {
  const [snapshot, games, lines] = await Promise.all([getSnapshot(), getGames(), getOurLines()]);

  if (!snapshot && !games.length) {
    return (
      <>
        <Header subtitle="NHL 26 Pro Club" />
        <EmptyState title="No games saved yet" hint="The collector checks EA every 10 minutes." />
      </>
    );
  }

  const season = snapshot ? seasonProgress(snapshot.seasonResults, snapshot.division) : null;
  const nights = groupGameNights(games);
  const latest = nights[0];
  const latestIds = new Set(latest?.games.map((g) => g.matchId));
  const mvp = latest ? nightMvp(lines.filter((l) => latestIds.has(l.matchId)), CLUB_ID) : null;
  const hot = hotPlayers(lines, games, CLUB_ID);

  const subtitle = snapshot
    ? `Division ${snapshot.division}${season?.division ? ` · ${season.division.conference}` : ""} · ${snapshot.wins}-${snapshot.losses}-${snapshot.otl} all-time`
    : "NHL 26 Pro Club";

  const blocks = [
    season && snapshot && <SeasonCard key="season" season={season} seasonResults={snapshot.seasonResults} />,
    snapshot && (
      <TrophyCase key="trophies" titles={snapshot.titles} promotions={snapshot.promotions} holds={snapshot.holds} relegations={snapshot.relegations} />
    ),
    latest && <LatestNight key="night" night={latest} mvp={mvp} />,
    <HotPlayers key="hot" players={hot} />,
  ].filter(Boolean);

  return (
    <>
      <Header subtitle={subtitle} />
      {blocks.map((b, i) => (
        <FadeIn key={i} index={i}>
          {b}
        </FadeIn>
      ))}
    </>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="flex items-center gap-3 py-2">
      <Crest assetId={CLUB_CREST_ASSET} size={48} name={CLUB_NAME} />
      <div>
        <h1 className="text-lg leading-tight font-extrabold">{CLUB_NAME}</h1>
        <p className="text-[11px] text-[var(--muted-fg)]">{subtitle}</p>
      </div>
    </header>
  );
}

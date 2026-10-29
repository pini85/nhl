import { ClubLogo } from "@/components/club/ClubLogo";
import { FadeIn } from "@/components/club/FadeIn";
import { HotPlayers } from "@/components/club/HotPlayers";
import { NemesisCards } from "@/components/club/NemesisCards";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { LatestNight } from "@/components/club/LatestNight";
import { SeasonCard } from "@/components/club/SeasonCard";
import { EmptyState } from "@/components/club/Section";
import { TrophyCase } from "@/components/club/TrophyCase";
import { CLUB_ID, CLUB_NAME } from "@/lib/config";
import { getGames, getOurLines, getSnapshot, getSnapshotHistory } from "@/lib/data/club";
import { NightTrendChart } from "@/components/charts/NightTrendChart";
import { NightTrend } from "@/components/charts/NightTrend";
import { divisionJourney, heatMap, nightSeries } from "@/lib/stats/trends";
import { getClubRows, getScoutedClubs } from "@/lib/data/opponents";
import { crestMap } from "@/lib/opponents/directory";
import { headToHead, nemesis } from "@/lib/stats/opponents";
import { groupGameNights, nightMvp } from "@/lib/stats/nights";
import { hotPlayers } from "@/lib/stats/players";
import { seasonProgress } from "@/lib/stats/season";
import { celebrationFor } from "@/lib/stats/celebrate";
import { funFacts } from "@/lib/stats/funfacts";
import { InstallCard } from "@/components/club/InstallPrompt";
import { OnboardingHole } from "@/components/club/OnboardingHole";
import { HomePersonal } from "@/components/club/HomePersonal";
import { MomentCards } from "@/components/club/MomentCards";
import { FunFacts } from "@/components/club/FunFacts";
import { Celebrate } from "@/components/club/Celebrate";

export default async function Home() {
  const [snapshot, games, lines, clubRows, scouted, history] = await Promise.all([
    getSnapshot(),
    getGames(),
    getOurLines(),
    getClubRows(),
    getScoutedClubs(),
    getSnapshotHistory(),
  ]);

  if (!snapshot && !games.length) {
    return (
      <>
        <Header subtitle="NHL 27 Pro Club" />
        <EmptyState title="No games saved yet" hint="The collector checks EA every 10 minutes." />
      </>
    );
  }

  const season = snapshot ? seasonProgress(snapshot.seasonResults, snapshot.division) : null;
  const nights = groupGameNights(games);
  const latest = nights[0];
  const latestIds = new Set(latest?.games.map((g) => g.matchId));
  const mvp = latest ? nightMvp(lines.filter((l) => latestIds.has(l.matchId)), CLUB_ID) : null;
  const heats = heatMap(lines, games, CLUB_ID);
  const hot = hotPlayers(lines, games, CLUB_ID).map((p) => ({ ...p, heat: heats.get(p.eaPlayerId) ?? null }));
  const journey = divisionJourney(history);
  const nemesisList = nemesis(headToHead(games));

  const subtitle = snapshot
    ? `Division ${snapshot.division}${season?.division ? ` · ${season.division.conference}` : ""} · ${snapshot.wins}-${snapshot.losses}-${snapshot.otl} all-time`
    : "NHL 27 Pro Club";

  const party = season && snapshot ? celebrationFor(season.state, snapshot.division, snapshot.seasons) : null;
  const blocks = [
    <Suspense key="me" fallback={null}>
      <HomePersonal />
    </Suspense>,
    <Suspense key="moments" fallback={null}>
      <MomentCards limit={3} />
    </Suspense>,
    party && <Celebrate key="party" message={party.message} storageKey={party.key} />,
    season && snapshot && <SeasonCard key="season" season={season} seasonResults={snapshot.seasonResults} />,
    snapshot && (
      <TrophyCase key="trophies" titles={snapshot.titles} promotions={snapshot.promotions} holds={snapshot.holds} relegations={snapshot.relegations} />
    ),
    journey.length > 0 && <DivisionJourney key="journey" runs={journey} />,
    latest && <LatestNight key="night" night={latest} mvp={mvp} />,
    nights.length > 0 && (
      <Suspense key="trend" fallback={<NightTrendChart data={nightSeries(nights)} />}>
        <NightTrend nights={nights} />
      </Suspense>
    ),
    <HotPlayers key="hot" players={hot} />,
    games.length >= 3 && (
      <Link key="wrapped" href="/wrapped" className="arena-card my-3 flex items-center justify-between px-3.5 py-3 text-sm font-semibold">
        <span>🎁 All-time Wrapped</span>
        <span className="text-[var(--accent-blue)]">Open →</span>
      </Link>
    ),
    <FunFacts key="facts" facts={funFacts(lines, games, CLUB_ID).map(({ key, text }) => ({ key, text }))} />,
    <Link key="search" href="/opponents" className="arena-card my-3 flex items-center gap-2 px-3.5 py-3 text-sm text-[var(--muted-fg)]">
      <Search className="size-4" aria-hidden /> Scouting a club? Search opponents
    </Link>,
    <InstallCard key="install" />,
    nemesisList.length > 0 && <NemesisCards key="nemesis" nemesis={nemesisList} bags={[]} crests={crestMap(clubRows, scouted)} />,
  ].filter(Boolean);

  return (
    <>
      <Suspense fallback={null}>
        <OnboardingHole />
      </Suspense>
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
      <ClubLogo size={64} className="rounded-2xl shadow-[0_0_24px_rgba(92,200,255,0.25)]" />
      <div>
        <h1 className="text-lg leading-tight font-extrabold">{CLUB_NAME}</h1>
        <p className="text-[11px] text-[var(--muted-fg)]">{subtitle}</p>
      </div>
    </header>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", month: "short", day: "numeric" });

function DivisionJourney({ runs }: { runs: { division: number; from: Date; to: Date }[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 py-1 text-[11px] text-[var(--muted-fg)]">
      <span className="shrink-0">Division journey:</span>
      {runs.map((r, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1.5">
          {i > 0 && <span aria-hidden>{r.division < runs[i - 1].division ? "⬆" : "⬇"}</span>}
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[var(--fg)]">
            Div {r.division} <span className="text-[var(--muted-fg)]">since {dayFmt.format(r.from)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

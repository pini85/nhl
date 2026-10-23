import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LocalTime } from "@/components/club/LocalTime";
import { ResultPill } from "@/components/club/ResultPill";
import { Section } from "@/components/club/Section";
import { ShareButton } from "@/components/club/ShareButton";
import { StatTile } from "@/components/club/StatTile";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_ID, CLUB_NAME } from "@/lib/config";
import { getGames, getOurLines } from "@/lib/data/club";
import { nightRecap } from "@/lib/stats/nightRecap";

export default function NightPage({ params }: PageProps<"/nights/[key]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <NightContent params={params} />
    </Suspense>
  );
}

async function NightContent({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [games, lines] = await Promise.all([getGames(), getOurLines()]);
  const recap = nightRecap(key, games, lines, CLUB_ID);
  if (!recap) notFound();
  const { night, mvp, stars, leaders, hasPlayerData } = recap;
  const chrono = [...night.games].reverse();

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Link href="/games" className="text-xs text-[var(--muted-fg)]">
          ← Games
        </Link>
        <ShareButton title={`${CLUB_NAME} · ${night.label}: ${night.wins}-${night.losses}`} />
      </div>

      <section className="arena-card my-3 p-4 text-center">
        <div className="text-[10px] tracking-[0.2em] text-[var(--muted-fg)] uppercase">Game night · {night.label}</div>
        <div className="glow tabular mt-1 text-5xl font-black">
          <span className="text-[var(--win-fg)]">{night.wins}</span>
          <span className="text-[var(--accent-blue)]">–</span>
          <span className="text-[var(--loss-fg)]">{night.losses}</span>
        </div>
        <div className="tabular text-xs text-[var(--muted-fg)]">
          {night.games.length} games · GF {night.goalsFor} · GA {night.goalsAgainst}
        </div>
        <div className="mt-3 flex justify-center gap-1">
          {chrono.map((g) => (
            <ResultPill key={g.matchId} outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} />
          ))}
        </div>
      </section>

      {mvp && mvp.points > 0 && (
        <Section title="⭐ Night MVP">
          <Link href={`/players/${mvp.eaPlayerId}`} className="flex items-center justify-between">
            <span className="text-lg font-black">{mvp.playerName}</span>
            <b className="tabular text-[var(--accent-blue)]">
              {mvp.goals}G {mvp.assists}A
            </b>
          </Link>
        </Section>
      )}

      {hasPlayerData && stars.length > 0 && (
        <Section title="Three stars of the night">
          <ol className="space-y-1 text-sm">
            {stars.map((s, i) => (
              <li key={s.eaPlayerId} className="flex justify-between">
                <span>
                  {"⭐".repeat(3 - i)} {s.name}
                </span>
                <b className="tabular">
                  {s.goals}G {s.assists}A
                </b>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {hasPlayerData && (
        <Section title="Night leaders">
          <div className="grid grid-cols-2 gap-1.5">
            {leaders.hits && <StatTile label={`Hits · ${leaders.hits.name}`} value={leaders.hits.value} />}
            {leaders.shots && <StatTile label={`Shots · ${leaders.shots.name}`} value={leaders.shots.value} />}
            {leaders.plusMinus && <StatTile label={`+/- · ${leaders.plusMinus.name}`} value={`+${leaders.plusMinus.value}`} />}
            {leaders.goalie && (
              <StatTile label={`SV% · ${leaders.goalie.name}`} value={leaders.goalie.pct.toFixed(3).replace(/^0/, "")} />
            )}
          </div>
        </Section>
      )}

      <Section title="Games">
        <ul className="divide-y divide-white/[0.05]">
          {chrono.map((g) => (
            <li key={g.matchId}>
              <Link href={`/games/${g.matchId}`} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0">
                  <ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} />
                </span>
                <span className="tabular w-10 font-bold">
                  {g.goalsFor}-{g.goalsAgainst}
                </span>
                <span className="min-w-0 flex-1 truncate">{g.opponentName ?? `Club ${g.opponentClubId}`}</span>
                {g.source === "full" && (
                  <span className="text-[11px] text-[var(--muted-fg)]">
                    <LocalTime iso={g.playedAt.toISOString()} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

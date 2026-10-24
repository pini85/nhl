import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeChip } from "@/components/club/Leaders";
import { LocalTime } from "@/components/club/LocalTime";
import { ResultPill } from "@/components/club/ResultPill";
import { Section } from "@/components/club/Section";
import { StatTile } from "@/components/club/StatTile";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines, getPlayer, getSnapshot } from "@/lib/data/club";
import { getClubRows } from "@/lib/data/opponents";
import { allAwards, badgeCabinet } from "@/lib/stats/awards";
import { BadgeCabinet } from "@/components/club/AwardChips";
import { playerTotals } from "@/lib/stats/players";
import { heat, playerForm } from "@/lib/stats/trends";
import { playerCard } from "@/lib/stats/cards";
import { PlayerCard } from "@/components/club/PlayerCard";
import { FormChart } from "@/components/charts/FormChart";
import { HeatBadge } from "@/components/club/HeatBadge";

const POS: Record<string, string> = { center: "Center", leftWing: "Left wing", rightWing: "Right wing", defenseMen: "Defense", goalie: "Goalie" };

export default function PlayerPage({ params }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <PlayerContent params={params} />
    </Suspense>
  );
}

async function PlayerContent({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const [detail, snapshot, allGames, allLines, clubRows, extras] = await Promise.all([
    getPlayer(playerId),
    getSnapshot(),
    getGames(),
    getOurLines(),
    getClubRows(),
    getExtraStats(),
  ]);
  if (!detail) notFound();
  const { lines, games } = detail;
  const roster = snapshot?.members ?? null;
  const mine = extras.filter((e) => e.eaPlayerId === playerId);
  const { skaters, goalies } = playerTotals(lines, games, roster, CLUB_ID, mine);
  const sk = skaters[0];
  const gl = goalies[0];
  const name = sk?.name ?? gl?.name ?? lines[0].playerName;
  const badge = sk?.badge ?? gl?.badge ?? "guest";
  const positions: Record<string, number> = {};
  for (const l of lines) positions[l.position] = (positions[l.position] ?? 0) + 1;
  const mainPos = Object.entries(positions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const career = roster?.find((m) => m.name.toLowerCase() === name.toLowerCase());

  const lineByMatch = new Map(lines.map((l) => [l.matchId, l]));
  const recent = games.slice(0, 10);
  const best = [...lines].sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals)[0];
  const bestGame = games.find((g) => g.matchId === best?.matchId);

  return (
    <>
      <header className="py-2">
        <h1 className="text-2xl font-black">
          {name} <HeatBadge heat={heat(lines, games, playerId)} />
          <BadgeChip badge={badge} />
        </h1>
        <p className="text-xs text-[var(--muted-fg)]">
          {POS[mainPos] ?? mainPos} · {(sk?.gp ?? 0) + (gl?.gp ?? 0) || lines.length} games for Drop drop drop
        </p>
      </header>

      <PlayerCard card={playerCard(lines, games, playerId)} name={name} position={mainPos} heat={heat(lines, games, playerId)} />

      {sk && (
        <Section title="Club stats · skater">
          <div className="grid grid-cols-4 gap-1.5">
            <StatTile label="GP" value={sk.gp} />
            <StatTile label="Goals" value={sk.goals} glow />
            <StatTile label="Assists" value={sk.assists} />
            <StatTile label="Points" value={sk.points} glow />
            <StatTile label="P/GP" value={sk.pointsPerGame.toFixed(2)} />
            <StatTile label="+/-" value={sk.plusMinus > 0 ? `+${sk.plusMinus}` : sk.plusMinus} />
            <StatTile label="Shots" value={sk.shots} />
            <StatTile label="SH%" value={`${sk.shotPct.toFixed(0)}%`} />
          </div>
          {mine.length > 0 && (
            <p className="mt-2 text-[10px] text-[var(--muted-fg)]">Includes older games without a box score, from the in-game club stats.</p>
          )}
        </Section>
      )}

      {sk && <FormChart data={playerForm(lines, games)} />}

      {gl && (
        <Section title="Club stats · goalie">
          <div className="grid grid-cols-4 gap-1.5">
            <StatTile label="GP" value={gl.gp} />
            <StatTile label="SV%" value={gl.savePct.toFixed(3).replace(/^0/, "")} glow />
            <StatTile label="GAA" value={gl.gaa.toFixed(2)} />
            <StatTile label="Record" value={`${gl.wins}-${gl.losses}`} />
          </div>
        </Section>
      )}

      <BadgeCabinet badges={badgeCabinet(allAwards(allLines, allGames, clubRows, CLUB_ID), playerId)} />

      {bestGame && best && best.goals + best.assists > 0 && (
        <Section title="Best game">
          <Link href={`/games/${bestGame.matchId}`} className="flex items-center justify-between text-sm">
            <span>
              vs {bestGame.opponentName ?? `Club ${bestGame.opponentClubId}`}{" "}
              <span className="text-[var(--muted-fg)]">
                {bestGame.goalsFor}-{bestGame.goalsAgainst}
              </span>
            </span>
            <b className="tabular text-[var(--accent-blue)]">
              {best.goals}G {best.assists}A
            </b>
          </Link>
        </Section>
      )}

      <Section title="Last 10 games">
        <ul className="divide-y divide-white/[0.05]">
          {recent.map((g) => {
            const l = lineByMatch.get(g.matchId)!;
            return (
              <li key={g.matchId}>
                <Link href={`/games/${g.matchId}`} className="flex items-center gap-2.5 py-2 text-sm">
                  <span className="w-11 shrink-0">
                    <ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{g.opponentName ?? `Club ${g.opponentClubId}`}</span>
                  <span className="tabular text-xs text-[var(--muted-fg)]">
                    {l.position === "goalie" ? `${l.glSaves}/${l.glShots} SV` : `${l.goals}G ${l.assists}A ${l.plusMinus > 0 ? "+" : ""}${l.plusMinus}`}
                  </span>
                  <span className="w-14 text-right text-[11px] text-[var(--muted-fg)]">
                    <LocalTime iso={g.playedAt.toISOString()} format="date" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {career && (
        <Section title="NHL 26 career">
          <div className="grid grid-cols-4 gap-1.5">
            <StatTile label="GP" value={career.gp} />
            <StatTile label="Goals" value={career.goals} />
            <StatTile label="Assists" value={career.assists} />
            <StatTile label="Points" value={career.points} />
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted-fg)]">Career totals from EA, across all clubs.</p>
        </Section>
      )}
    </>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Leaders } from "@/components/club/Leaders";
import { EmptyState } from "@/components/club/Section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { extrasInRange, filterGames, playerTotals } from "@/lib/stats/players";
import { clubRecords, currentStreak, milestones } from "@/lib/stats/records";
import { RecordsView } from "@/components/club/RecordsView";
import { LinesView } from "@/components/club/LinesView";
import { chemistry, withWithout } from "@/lib/stats/chemistry";
import { heatMap } from "@/lib/stats/trends";
import { playerCard } from "@/lib/stats/cards";

export const metadata = { title: "Players" };

export default function PlayersPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Players</h1>
        <Link href="/players/compare" className="rounded-full border border-[var(--card-border)] px-3 py-1 text-xs font-semibold text-[var(--accent-blue)]">
          Compare ⚖️
        </Link>
      </div>
      <Tabs defaultValue="leaders" className="mt-2">
        <TabsList className="w-full">
          <TabsTrigger value="leaders">Leaders</TabsTrigger>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>
        <TabsContent value="leaders">
          <Suspense fallback={<Skeleton className="mt-3 h-72 w-full rounded-2xl" />}>
            <LeadersData />
          </Suspense>
        </TabsContent>
        <TabsContent value="lines">
          <Suspense fallback={<Skeleton className="mt-3 h-72 w-full rounded-2xl" />}>
            <LinesData />
          </Suspense>
        </TabsContent>
        <TabsContent value="records">
          <Suspense fallback={<Skeleton className="mt-3 h-72 w-full rounded-2xl" />}>
            <RecordsData />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}

async function LeadersData() {
  await connection(); // "30 days" depends on the current time
  const [games, lines, snapshot, extras] = await Promise.all([getGames(), getOurLines(), getSnapshot(), getExtraStats()]);
  if (!lines.length) return <EmptyState title="No player stats yet" />;
  const now = new Date();
  const totalsFor = (range: "all" | "30d" | "last10") => {
    const ids = filterGames(games, range, now);
    return playerTotals(lines.filter((l) => ids.has(l.matchId)), games, snapshot?.members ?? null, CLUB_ID, extrasInRange(extras, range, now));
  };
  const withExtras = {
    all: extrasInRange(extras, "all", now).length > 0,
    "30d": extrasInRange(extras, "30d", now).length > 0,
    last10: false,
  };
  const heat = Object.fromEntries(heatMap(lines, games, CLUB_ID));
  const ovr = Object.fromEntries(
    [...new Set(lines.map((l) => l.eaPlayerId))].map((id) => [id, playerCard(lines, games, id)?.ovr ?? null]),
  );
  return <Leaders data={{ all: totalsFor("all"), "30d": totalsFor("30d"), last10: totalsFor("last10") }} heat={heat} ovr={ovr} withExtras={withExtras} />;
}

async function RecordsData() {
  const [games, lines] = await Promise.all([getGames(), getOurLines()]);
  if (!games.length) return <EmptyState title="No records yet" />;
  return <RecordsView records={clubRecords(lines, games, CLUB_ID)} streak={currentStreak(games)} milestones={milestones(lines, games, CLUB_ID)} />;
}

async function LinesData() {
  const [games, lines] = await Promise.all([getGames(), getOurLines()]);
  const { trios, pairs } = chemistry(lines, games, CLUB_ID);
  return <LinesView trios={trios} pairs={pairs} withWithout={withWithout(lines, games, CLUB_ID)} />;
}

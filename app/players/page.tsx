import { connection } from "next/server";
import { Suspense } from "react";
import { Leaders } from "@/components/club/Leaders";
import { EmptyState } from "@/components/club/Section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLUB_ID } from "@/lib/config";
import { getGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { filterGames, playerTotals } from "@/lib/stats/players";
import { clubRecords, currentStreak, milestones } from "@/lib/stats/records";
import { RecordsView } from "@/components/club/RecordsView";
import { heatMap } from "@/lib/stats/trends";

export const metadata = { title: "Players" };

export default function PlayersPage() {
  return (
    <>
      <h1 className="text-2xl font-black">Players</h1>
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
          <EmptyState title="Line chemistry is coming soon" hint="Win % for every trio and D-pair." />
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
  const [games, lines, snapshot] = await Promise.all([getGames(), getOurLines(), getSnapshot()]);
  if (!lines.length) return <EmptyState title="No player stats yet" />;
  const now = new Date();
  const totalsFor = (range: "all" | "30d" | "last10") => {
    const ids = filterGames(games, range, now);
    return playerTotals(lines.filter((l) => ids.has(l.matchId)), games, snapshot?.members ?? null, CLUB_ID);
  };
  const heat = Object.fromEntries(heatMap(lines, games, CLUB_ID));
  return <Leaders data={{ all: totalsFor("all"), "30d": totalsFor("30d"), last10: totalsFor("last10") }} heat={heat} />;
}

async function RecordsData() {
  const [games, lines] = await Promise.all([getGames(), getOurLines()]);
  if (!games.length) return <EmptyState title="No records yet" />;
  return <RecordsView records={clubRecords(lines, games, CLUB_ID)} streak={currentStreak(games)} milestones={milestones(lines, games, CLUB_ID)} />;
}

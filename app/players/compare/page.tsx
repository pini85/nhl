import Link from "next/link";
import { CompareView } from "@/components/club/CompareView";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines, getSnapshot } from "@/lib/data/club";
import { playerTotals } from "@/lib/stats/players";

export const metadata = { title: "Compare" };

export default async function ComparePage() {
  const [games, lines, snapshot, extras] = await Promise.all([getGames(), getOurLines(), getSnapshot(), getExtraStats()]);
  const { skaters } = playerTotals(lines, games, snapshot?.members ?? null, CLUB_ID, extras);
  return (
    <>
      <Link href="/players" className="text-xs text-[var(--muted-fg)]">
        ← Players
      </Link>
      <h1 className="mt-1 text-2xl font-black">Compare teammates</h1>
      <p className="text-xs text-[var(--muted-fg)]">Club-only stats, side by side</p>
      <CompareView skaters={skaters} />
    </>
  );
}

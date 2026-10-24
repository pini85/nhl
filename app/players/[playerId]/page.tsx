import { Suspense } from "react";
import { PlayerProfile } from "@/components/club/PlayerProfile";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerPage({ params }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <PlayerContent params={params} />
    </Suspense>
  );
}

async function PlayerContent({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  return <PlayerProfile playerId={playerId} />;
}

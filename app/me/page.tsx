import { Suspense } from "react";
import { MyNight } from "@/components/club/MyNight";
import { PlayerProfile } from "@/components/club/PlayerProfile";
import { PickerToggle, RosterPicker } from "@/components/club/RosterPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines } from "@/lib/data/club";
import { getMe } from "@/lib/me-server";
import { activeStreaks, lastNight, rosterChoices } from "@/lib/stats/personal";

export const metadata = { title: "Me" };

export default function MePage() {
  return (
    <Suspense fallback={<Skeleton className="mt-4 h-64 w-full rounded-2xl" />}>
      <MeContent />
    </Suspense>
  );
}

async function MeContent() {
  const { me } = await getMe();
  const [lines, games, extras] = await Promise.all([getOurLines(), getGames(), getExtraStats()]);
  const { main, rest } = rosterChoices(lines, games, CLUB_ID, new Date(), extras);

  if (me.kind === "player") {
    return (
      <>
        <PlayerProfile
          playerId={me.playerId}
          you
          top={<MyNight night={lastNight(lines, games, me.playerId, CLUB_ID)} streaks={activeStreaks(lines, games, me.playerId)} />}
        />
        <PickerToggle label="Not you? Switch player" main={main} rest={rest} />
      </>
    );
  }

  if (me.kind === "guest") {
    return (
      <div className="py-4">
        <h1 className="text-2xl font-black">Me</h1>
        <p className="mt-2 text-sm text-[var(--muted-fg)]">You said you&apos;re not on the team.</p>
        <PickerToggle label="Pick your player" main={main} rest={rest} />
      </div>
    );
  }

  return (
    <div className="py-2">
      <h1 className="sr-only">Me</h1>
      <h2 className="text-2xl font-black">Set up your profile</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--muted-fg)]">Tap your gamertag to get your own stats, streaks and milestones.</p>
      <RosterPicker main={main} rest={rest} />
    </div>
  );
}

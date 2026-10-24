import { Suspense } from "react";
import { MomentCards } from "@/components/club/MomentCards";
import { MyNight } from "@/components/club/MyNight";
import { Onboarding } from "@/components/club/Onboarding";
import { PlayerProfile } from "@/components/club/PlayerProfile";
import { PickerToggle, RosterPicker } from "@/components/club/RosterPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines } from "@/lib/data/club";
import { getMe, requestTime } from "@/lib/me-server";
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
  const now = await requestTime();
  const { main, rest } = rosterChoices(lines, games, CLUB_ID, now, extras);
  // First in every branch, so it keeps its step when the page re-renders after a pick.
  const onboarding = <Onboarding needed={me.kind === "unset"} main={main} rest={rest} />;

  if (me.kind === "player") {
    return (
      <>
        {onboarding}
        <PlayerProfile
          playerId={me.playerId}
          you
          top={
            <>
              <MomentCards onlyMine title="Your moments" />
              <MyNight night={lastNight(lines, games, me.playerId, CLUB_ID)} streaks={activeStreaks(lines, games, me.playerId, now)} />
            </>
          }
        />
        <PickerToggle label="Not you? Switch player" main={main} rest={rest} />
      </>
    );
  }

  if (me.kind === "guest") {
    return (
      <>
        {onboarding}
        <div className="py-4">
        <h1 className="text-2xl font-black">Me</h1>
        <p className="mt-2 text-sm text-[var(--muted-fg)]">You said you&apos;re not on the team.</p>
        <PickerToggle label="Pick your player" main={main} rest={rest} />
        </div>
      </>
    );
  }

  return (
    <>
      {onboarding}
      <div className="py-2">
      <h1 className="sr-only">Me</h1>
      <h2 className="text-2xl font-black">Set up your profile</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--muted-fg)]">Tap your gamertag to get your own stats, streaks and milestones.</p>
      <RosterPicker main={main} rest={rest} />
      </div>
    </>
  );
}

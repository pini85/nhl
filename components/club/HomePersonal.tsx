import Link from "next/link";
import { SetupCard } from "@/components/club/SetupCard";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines } from "@/lib/data/club";
import { getMe, requestTime } from "@/lib/me-server";
import { activeStreaks, homeCardParts, lastNight, nextMilestones } from "@/lib/stats/personal";

/** Home: "Hey {name} 👋" for a picked teammate, a "Set up your profile" nudge for people who haven't picked. */
export async function HomePersonal() {
  const { me } = await getMe();
  if (me.kind === "guest") return null;
  if (me.kind !== "player") return <SetupCard />;
  const now = await requestTime();
  const [lines, games, extras] = await Promise.all([getOurLines(), getGames(), getExtraStats()]);
  const id = me.playerId;
  const name = lines.findLast((l) => l.eaPlayerId === id)?.playerName ?? "you";
  const parts = homeCardParts(lastNight(lines, games, id, CLUB_ID), activeStreaks(lines, games, id), nextMilestones(lines, extras, id), now);
  return (
    <Link href="/me" className="arena-card my-3 block px-3.5 py-3 active:bg-white/[0.06]">
      <p className="font-bold">Hey {name} 👋</p>
      {parts.length > 0 && <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-fg)]">{parts.join(" · ")}</p>}
    </Link>
  );
}

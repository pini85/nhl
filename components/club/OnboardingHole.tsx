import { Onboarding } from "@/components/club/Onboarding";
import { CLUB_ID } from "@/lib/config";
import { getExtraStats, getGames, getOurLines } from "@/lib/data/club";
import { getMe, requestTime } from "@/lib/me-server";
import { rosterChoices } from "@/lib/stats/personal";

/** Server piece for Home: reads the cookie, then hands the roster to the onboarding overlay. */
export async function OnboardingHole() {
  const { me } = await getMe();
  const [lines, games, extras] = await Promise.all([getOurLines(), getGames(), getExtraStats()]);
  const { main, rest } = rosterChoices(lines, games, CLUB_ID, await requestTime(), extras);
  return <Onboarding needed={me.kind === "unset"} main={main} rest={rest} />;
}

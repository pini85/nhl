import type { MomentItem } from "@/components/club/MomentCard";
import { MomentList } from "@/components/club/MomentCard";
import { getMe, loadMomentInput, requestTime } from "@/lib/me-server";
import { activeMoments, isAboutMe, momentHref, momentText } from "@/lib/stats/moments";

/** Unseen moments from the last 14 days: yours first, then newest. Home shows everyone's; the Me tab only yours. */
export async function MomentCards({ limit, onlyMine = false, title }: { limit?: number; onlyMine?: boolean; title?: string }) {
  const { me, seen } = await getMe();
  const now = await requestTime();
  const meId = me.kind === "player" ? me.playerId : null;
  const seenSet = new Set(seen);
  const list = activeMoments(await loadMomentInput(), now).filter((m) => !seenSet.has(m.id) && (!onlyMine || (meId !== null && isAboutMe(m, meId))));
  const mine = (m: (typeof list)[number]) => meId !== null && isAboutMe(m, meId);
  const items: MomentItem[] = [...list.filter(mine), ...list.filter((m) => !mine(m))].map((m) => ({
    id: m.id,
    text: momentText(m, meId),
    href: momentHref(m),
    mine: mine(m),
    celebrate: m.kind === "record" && meId !== null && m.playerId === meId,
  }));
  return <MomentList items={items} limit={limit} title={title} />;
}

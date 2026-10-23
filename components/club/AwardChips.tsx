import Link from "next/link";
import { Section } from "@/components/club/Section";
import { AWARD_INFO, type Award, type AwardKey } from "@/lib/stats/awards";

// One entry per player, most awards first.
function countByPlayer(list: Award[]) {
  const m = new Map<string, { eaPlayerId: string; name: string; count: number }>();
  for (const a of list) {
    const e = m.get(a.eaPlayerId) ?? { eaPlayerId: a.eaPlayerId, name: a.name, count: 0 };
    e.count++;
    m.set(a.eaPlayerId, e);
  }
  return [...m.values()].sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}

export function AwardChips({ awards, title = "Awards" }: { awards: Award[]; title?: string }) {
  if (!awards.length) return null;
  // Group by award so "🗡️ Giant slayer" lists the whole team once.
  const grouped = new Map<AwardKey, Award[]>();
  for (const a of awards) grouped.set(a.key, [...(grouped.get(a.key) ?? []), a]);
  return (
    <Section title={title}>
      <ul className="space-y-1.5">
        {[...grouped.entries()].map(([key, list]) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            <span className="w-6 shrink-0 text-center" aria-hidden>
              {AWARD_INFO[key].emoji}
            </span>
            <span className="min-w-0">
              <b>{AWARD_INFO[key].label}</b>{" "}
              <span className="text-[var(--muted-fg)]">
                {countByPlayer(list).map((p, i) => (
                  <span key={p.eaPlayerId}>
                    {i > 0 && ", "}
                    <Link href={`/players/${p.eaPlayerId}`}>{p.name}</Link>
                    {p.count > 1 && <b className="text-[var(--fg)]"> ×{p.count}</b>}
                  </span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function BadgeCabinet({ badges }: { badges: { key: AwardKey; emoji: string; label: string; count: number }[] }) {
  return (
    <Section title="Badge cabinet">
      {badges.length ? (
        <div className="grid grid-cols-3 gap-1.5">
          {badges.map((b) => (
            <div key={b.key} className="rounded-xl bg-white/[0.04] px-1 py-2 text-center" title={AWARD_INFO[b.key].hint}>
              <div className="text-xl" aria-hidden>
                {b.emoji}
              </div>
              <div className="tabular text-sm font-bold">×{b.count}</div>
              <div className="text-[9px] text-[var(--muted-fg)]">{b.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-fg)]">No badges yet. Hat tricks, big hits and giant upsets earn them.</p>
      )}
    </Section>
  );
}

import { Section } from "@/components/club/Section";
import type { ClubFinals } from "@/lib/stats/finals";
import { formatRecord } from "@/lib/stats/record";

export function TrophyCase({
  titles,
  promotions,
  holds,
  relegations,
  finals,
}: {
  titles: number;
  promotions: number;
  holds: number;
  relegations: number;
  finals?: ClubFinals;
}) {
  const items = [
    { icon: "🏆", n: titles, label: "Div titles", color: undefined },
    { icon: "⬆", n: promotions, label: "Promotions", color: "var(--win-fg)" },
    { icon: "🛡", n: holds, label: "Holds", color: undefined },
    { icon: "⬇", n: relegations, label: "Relegations", color: "var(--loss-fg)" },
  ];
  const finalsItems = finals && [
    { icon: "🎟", n: String(finals.appearances), label: "Appearances" },
    { icon: "🥇", n: String(finals.cups), label: "Cups won" },
    { icon: "🏒", n: finals.games ? formatRecord(finals.record) : "–", label: "Playoff W-L" },
  ];
  return (
    <Section title="Trophy case">
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {items.map((t) => (
          <div key={t.label} className="rounded-xl bg-white/[0.04] px-1 py-2">
            <div className="tabular text-lg font-extrabold" style={{ color: t.color }}>
              {t.icon} {t.n}
            </div>
            <div className="text-[9px] text-[var(--muted-fg)]">{t.label}</div>
          </div>
        ))}
      </div>
      {finalsItems && (
        <>
          <p className="mt-3 mb-1.5 text-[10px] font-bold tracking-[0.2em] text-[var(--muted-fg)] uppercase">Club finals</p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {finalsItems.map((t) => (
              <div key={t.label} className="rounded-xl bg-white/[0.04] px-1 py-2">
                <div className="tabular text-lg font-extrabold">
                  {t.icon} {t.n}
                </div>
                <div className="text-[9px] text-[var(--muted-fg)]">{t.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

import { Section } from "@/components/club/Section";

export function TrophyCase({ titles, promotions, holds, relegations }: { titles: number; promotions: number; holds: number; relegations: number }) {
  const items = [
    { icon: "🏆", n: titles, label: "Div titles", color: undefined },
    { icon: "⬆", n: promotions, label: "Promotions", color: "var(--win-fg)" },
    { icon: "🛡", n: holds, label: "Holds", color: undefined },
    { icon: "⬇", n: relegations, label: "Relegations", color: "var(--loss-fg)" },
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
    </Section>
  );
}

import { Section } from "@/components/club/Section";
import type { ClubFinals } from "@/lib/stats/finals";

type Tile = { icon: string; n: number | string; label: string; color?: string };

function Tiles({ items }: { items: Tile[] }) {
  return (
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
  );
}

const Heading = ({ children, first }: { children: string; first?: boolean }) => (
  <p className={`${first ? "" : "mt-3 "}mb-1.5 text-[10px] font-bold tracking-[0.2em] text-[var(--muted-fg)] uppercase`}>{children}</p>
);

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
  const season: Tile[] = [
    { icon: "🏆", n: titles, label: "Div titles" },
    { icon: "⬆", n: promotions, label: "Promotions", color: "var(--win-fg)" },
    { icon: "🛡", n: holds, label: "Holds" },
    { icon: "⬇", n: relegations, label: "Relegations", color: "var(--loss-fg)" },
  ];
  const losses = finals ? finals.record.losses + finals.record.otLosses : 0;
  const playoffs: Tile[] | undefined = finals && [
    { icon: "✅", n: finals.record.wins, label: "Wins", color: "var(--win-fg)" },
    { icon: "❌", n: losses, label: "Losses", color: "var(--loss-fg)" },
    { icon: "🎟", n: finals.appearances, label: "Appearances" },
    { icon: "🥇", n: finals.cups, label: "Cups won" },
  ];
  return (
    <Section title="Trophy case">
      <Heading first>Season</Heading>
      <Tiles items={season} />
      {playoffs && finals && (
        <>
          <Heading>Playoffs</Heading>
          <Tiles items={playoffs} />
          {finals.games > 0 && (
            <p className="mt-2 text-center text-[11px] text-[var(--muted-fg)]">
              {finals.games} round{finals.games === 1 ? "" : "s"} played · furthest: round {finals.furthestRound}
            </p>
          )}
        </>
      )}
    </Section>
  );
}

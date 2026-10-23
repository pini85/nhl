import type { PlayerCard as Card } from "@/lib/stats/cards";
import type { Heat } from "@/lib/stats/trends";

const TIER = {
  gold: { ring: "#ffd27a", bg: "linear-gradient(160deg, #3a2c0b 0%, #1a1405 60%, #0d0a03 100%)", label: "Gold" },
  silver: { ring: "#c0c8d8", bg: "linear-gradient(160deg, #2a3140 0%, #151a24 60%, #0b0e14 100%)", label: "Silver" },
  bronze: { ring: "#c98b5a", bg: "linear-gradient(160deg, #3a2414 0%, #1c120a 60%, #0e0905 100%)", label: "Bronze" },
} as const;

const POS: Record<string, string> = { center: "C", leftWing: "LW", rightWing: "RW", defenseMen: "D", goalie: "G" };

export function PlayerCard({ card, name, position, heat }: { card: Card | null; name: string; position: string; heat: Heat }) {
  if (!card) {
    return <p className="arena-card my-3 p-3.5 text-center text-xs text-[var(--muted-fg)]">🃏 Player card unlocks after 3 games</p>;
  }
  const t = TIER[card.tier];
  const facets: [string, number][] =
    card.kind === "skater"
      ? [
          ["OFF", card.off],
          ["DEF", card.def],
          ["TEAM", card.team],
          ["SHO", card.sho],
          ["PLY", card.ply],
          ["PHY", card.phy],
        ]
      : [
          ["SV%", card.ovr],
          ["GP", card.gp],
        ];
  return (
    <section
      className="relative mx-auto my-3 w-full max-w-[280px] overflow-hidden rounded-[22px] p-4"
      style={{ background: t.bg, border: `2px solid ${t.ring}`, boxShadow: `0 0 28px ${t.ring}33` }}
      aria-label={`${name} player card, overall ${card.ovr}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="tabular text-5xl leading-none font-black" style={{ color: t.ring }}>
            {card.ovr}
          </div>
          <div className="mt-1 text-xs font-bold tracking-widest" style={{ color: t.ring }}>
            {POS[position] ?? position} {heat === "hot" ? "↑" : heat === "cold" ? "↓" : ""}
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ color: t.ring, border: `1px solid ${t.ring}66` }}>
          {t.label}
        </span>
      </div>
      <div className="mt-4 truncate text-center text-xl font-black tracking-wide uppercase">{name}</div>
      <div className="mx-auto my-2 h-px w-3/4" style={{ background: `${t.ring}55` }} />
      <dl className="grid grid-cols-3 gap-y-1.5 text-center">
        {facets.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] font-bold tracking-widest text-[var(--muted-fg)]">{k}</dt>
            <dd className="tabular text-lg font-black">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-center text-[9px] text-[var(--muted-fg)]">
        {card.kind === "skater" ? `EA match ratings · ${card.gp} club games` : `${card.gp} club games · ${card.gaa.toFixed(2)} GAA`}
      </p>
    </section>
  );
}

import { EmptyState, Section } from "@/components/club/Section";
import type { Combo } from "@/lib/stats/chemistry";

function ComboList({ title, combos }: { title: string; combos: Combo[] }) {
  if (!combos.length) return null;
  return (
    <Section title={title}>
      <ul className="divide-y divide-white/[0.05]">
        {combos.map((c) => (
          <li key={c.names.join("|")} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold">{c.names.join(" · ")}</span>
              <b className="tabular shrink-0 text-base">
                <span className="text-[var(--win-fg)]">{c.wins}</span>-<span className="text-[var(--loss-fg)]">{c.losses}</span>
              </b>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${Math.round(c.winPct * 100)}%` }} />
              </div>
              <span className="tabular w-28 text-right text-[11px] text-[var(--muted-fg)]">
                {Math.round(c.winPct * 100)}% · {c.gfPerGame.toFixed(1)}–{c.gaPerGame.toFixed(1)} /gp
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function LinesView({
  trios,
  pairs,
  withWithout,
}: {
  trios: Combo[];
  pairs: Combo[];
  withWithout: { name: string; withPct: number; withGp: number; withoutPct: number | null; withoutGp: number }[];
}) {
  if (!trios.length && !pairs.length && !withWithout.length) {
    return <EmptyState title="Lines appear after 3 games together" />;
  }
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
  return (
    <>
      <ComboList title="Forward lines" combos={trios} />
      <ComboList title="D-pairs" combos={pairs} />
      {withWithout.length > 0 && (
        <Section title="Team win % with / without">
          <table className="tabular w-full text-sm">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="py-1 text-left font-medium">Player</th>
                <th className="py-1 text-right font-medium">With</th>
                <th className="py-1 text-right font-medium">Without</th>
              </tr>
            </thead>
            <tbody>
              {withWithout.map((w) => (
                <tr key={w.name} className="border-t border-white/[0.05]">
                  <td className="max-w-[140px] truncate py-1.5">{w.name}</td>
                  <td className="py-1.5 text-right">
                    <b>{pct(w.withPct)}</b> <span className="text-[10px] text-[var(--muted-fg)]">{w.withGp}gp</span>
                  </td>
                  <td className="py-1.5 text-right">
                    {pct(w.withoutPct)} <span className="text-[10px] text-[var(--muted-fg)]">{w.withoutGp}gp</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

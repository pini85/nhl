import type { ReactNode } from "react";

export function ChartFrame({
  title,
  label,
  legend,
  table,
  children,
}: {
  title: string;
  label: string;
  legend?: { name: string; color: string }[];
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  return (
    <section className="arena-card my-3 p-3.5" aria-label={label}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{title}</h2>
        {legend && legend.length > 1 && (
          <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] text-[var(--muted-fg)]">
            {legend.map((l) => (
              <li key={l.name} className="flex items-center gap-1 whitespace-nowrap">
                <span className="inline-block size-2 rounded-sm" style={{ background: l.color }} aria-hidden />
                {l.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
      <details className="mt-1 text-[11px] text-[var(--muted-fg)]">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="tabular mt-1 w-full">
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h} className="py-1 text-left font-medium first:pl-0 last:text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-white/[0.05] text-[var(--fg)]">
                {r.map((c, j) => (
                  <td key={j} className="py-1 last:text-right">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function ChartTooltip({ title, rows }: { title: string; rows: { name: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[#0d1526] px-2.5 py-1.5 text-[11px] shadow-lg">
      <div className="font-semibold text-[var(--fg)]">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-1.5 text-[var(--muted-fg)]">
          {r.color && <span className="inline-block size-2 rounded-sm" style={{ background: r.color }} aria-hidden />}
          {r.name} <b className="tabular ml-auto pl-2 text-[var(--fg)]">{r.value}</b>
        </div>
      ))}
    </div>
  );
}

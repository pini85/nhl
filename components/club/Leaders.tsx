"use client";

import Link from "next/link";
import { useState } from "react";
import { HeatBadge } from "@/components/club/HeatBadge";
import { sortLeaders } from "@/lib/stats/sort";
import type { Heat } from "@/lib/stats/trends";
import { cn } from "@/lib/utils";
import type { Badge, GoalieTotals, SkaterTotals } from "@/lib/stats/players";

type Range = "all" | "30d" | "last10";
type Data = Record<Range, { skaters: SkaterTotals[]; goalies: GoalieTotals[] }>;

const RANGES: { key: Range; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30d", label: "30 days" },
  { key: "last10", label: "Last 10" },
];

const SKATER_COLS: { key: keyof SkaterTotals; label: string; fmt?: (v: number) => string }[] = [
  { key: "gp", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "P" },
  { key: "plusMinus", label: "+/-", fmt: (v) => (v > 0 ? `+${v}` : String(v)) },
  { key: "shots", label: "S" },
  { key: "hits", label: "H" },
  { key: "shotPct", label: "SH%", fmt: (v) => v.toFixed(0) },
];

const GOALIE_COLS: { key: keyof GoalieTotals; label: string; fmt?: (v: number) => string }[] = [
  { key: "gp", label: "GP" },
  { key: "wins", label: "W" },
  { key: "saves", label: "SV" },
  { key: "shotsAgainst", label: "SA" },
  { key: "savePct", label: "SV%", fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "gaa", label: "GAA", fmt: (v) => v.toFixed(2) },
];

export function BadgeChip({ badge }: { badge: Badge }) {
  if (badge === "member") return null;
  return (
    <span className="ml-1 rounded bg-white/[0.07] px-1 py-px text-[9px] font-semibold tracking-wide text-[var(--muted-fg)] uppercase">
      {badge}
    </span>
  );
}

function Chips<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {items.map((i) => (
        <button
          key={i.key}
          onClick={() => onChange(i.key)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            value === i.key
              ? "border-[var(--accent-blue)] bg-[rgba(92,200,255,0.15)] text-[var(--accent-blue)]"
              : "border-[var(--card-border)] text-[var(--muted-fg)]",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Leaders({ data, heat = {} }: { data: Data; heat?: Record<string, Heat> }) {
  const [range, setRange] = useState<Range>("all");
  const [kind, setKind] = useState<"skaters" | "goalies">("skaters");
  const [sort, setSort] = useState<string>("points");

  const cols = kind === "skaters" ? SKATER_COLS : GOALIE_COLS;
  const rows = sortLeaders(data[range][kind] as Array<SkaterTotals | GoalieTotals>, sort);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <Chips
          items={[
            { key: "skaters", label: "Skaters" },
            { key: "goalies", label: "Goalies" },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setSort(k === "skaters" ? "points" : "savePct");
          }}
        />
        <Chips items={RANGES} value={range} onChange={setRange} />
      </div>

      <section className="arena-card overflow-x-auto">
        {!rows.length ? (
          <p className="p-4 text-sm text-[var(--muted-fg)]">No {kind} in this range.</p>
        ) : (
          <table className="tabular w-full text-xs">
            <thead className="text-[10px] text-[var(--muted-fg)]">
              <tr>
                <th className="sticky left-0 bg-[#0b1220] px-3 py-2 text-left font-medium">Player</th>
                {cols.map((c) => (
                  <th key={String(c.key)} className="px-1.5 py-2 text-right font-medium last:pr-3">
                    <button onClick={() => setSort(String(c.key))} className={cn(sort === c.key && "text-[var(--accent-blue)]")}>
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.eaPlayerId} className="border-t border-white/[0.05]">
                  <td className="sticky left-0 bg-[#0b1220] px-3 py-2">
                    <div className="flex max-w-[150px] items-center">
                      <span className="mr-1.5 shrink-0 text-[10px] text-[var(--muted-fg)]">{i + 1}</span>
                      <Link href={`/players/${r.eaPlayerId}`} className="truncate font-semibold">
                        {r.name}
                      </Link>
                      <span className="ml-1 shrink-0">
                        {kind === "skaters" && <HeatBadge heat={heat[r.eaPlayerId]} />}
                      </span>
                      <span className="shrink-0">
                        <BadgeChip badge={r.badge} />
                      </span>
                    </div>
                  </td>
                  {cols.map((c) => {
                    const v = Number((r as Record<string, unknown>)[c.key as string] ?? 0);
                    return (
                      <td key={String(c.key)} className={cn("px-1.5 text-right last:pr-3", sort === c.key && "font-bold text-[var(--fg)]")}>
                        {c.fmt ? c.fmt(v) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="mt-2 text-[10px] text-[var(--muted-fg)]">Only games played for Drop drop drop. Tap a column to sort.</p>
    </>
  );
}

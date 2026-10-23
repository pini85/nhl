"use client";

import { useState } from "react";
import { THEM, US } from "@/components/charts/palette";
import { compareRows } from "@/lib/stats/compare";
import type { SkaterTotals } from "@/lib/stats/players";

export function CompareView({ skaters }: { skaters: SkaterTotals[] }) {
  const [aId, setA] = useState(skaters[0]?.eaPlayerId ?? "");
  const [bId, setB] = useState(skaters[1]?.eaPlayerId ?? "");
  const a = skaters.find((s) => s.eaPlayerId === aId);
  const b = skaters.find((s) => s.eaPlayerId === bId);
  if (skaters.length < 2) return <p className="mt-4 text-sm text-[var(--muted-fg)]">Need at least two skaters to compare.</p>;

  const select = (value: string, set: (v: string) => void, color: string, label: string) => (
    <label className="flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-xl border bg-[#0d1526] px-2 py-2 text-sm font-semibold"
        style={{ borderColor: color }}
      >
        {skaters.map((s) => (
          <option key={s.eaPlayerId} value={s.eaPlayerId}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        {select(aId, setA, US, "First player")}
        <span className="text-xs text-[var(--muted-fg)]">vs</span>
        {select(bId, setB, THEM, "Second player")}
      </div>
      {a && b && (
        <section className="arena-card my-3 p-3.5" aria-label={`${a.name} compared with ${b.name}`}>
          <ul className="flex justify-between text-[10px] text-[var(--muted-fg)]">
            <li className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm" style={{ background: US }} aria-hidden /> {a.name}
            </li>
            <li className="flex items-center gap-1">
              {b.name} <span className="inline-block size-2 rounded-sm" style={{ background: THEM }} aria-hidden />
            </li>
          </ul>
          <ul className="mt-2 space-y-2.5">
            {compareRows(a, b).map((r) => {
              const max = Math.max(Math.abs(r.a), Math.abs(r.b), 1);
              return (
                <li key={r.label}>
                  <div className="flex items-center justify-between text-xs">
                    <b className={r.better === "a" ? "text-[var(--fg)]" : "font-normal text-[var(--muted-fg)]"}>{r.a}</b>
                    <span className="text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">{r.label}</span>
                    <b className={r.better === "b" ? "text-[var(--fg)]" : "font-normal text-[var(--muted-fg)]"}>{r.b}</b>
                  </div>
                  <div className="mt-1 flex gap-0.5">
                    <div className="flex h-1.5 flex-1 justify-end rounded-l-full bg-white/[0.05]">
                      <div className="h-full rounded-l-full" style={{ width: `${(Math.abs(r.a) / max) * 100}%`, background: US }} />
                    </div>
                    <div className="flex h-1.5 flex-1 rounded-r-full bg-white/[0.05]">
                      <div className="h-full rounded-r-full" style={{ width: `${(Math.abs(r.b) / max) * 100}%`, background: THEM }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

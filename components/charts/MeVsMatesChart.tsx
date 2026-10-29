"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, MATES, ME } from "@/components/charts/palette";
import { Chips } from "@/components/club/Leaders";
import type { MateGroup, NightPoint, StatKey } from "@/lib/stats/trends";

const SURFACE = "#0d1424";
const STATS: { key: StatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "points", label: "Points" },
];
const GROUPS: { key: MateGroup; label: string; avg: string }[] = [
  { key: "all", label: "All", avg: "Teammate avg" },
  { key: "forwards", label: "Forwards", avg: "Forward avg" },
  { key: "defense", label: "Defense", avg: "Defense avg" },
];

/** The picked player's goals, assists or points per night against the average teammate (all skaters, forwards or defense). */
export function MeVsMatesChart({ data }: { data: NightPoint[] }) {
  const [stat, setStat] = useState<StatKey>("goals");
  const [group, setGroup] = useState<MateGroup>("all");
  if (!data.some((d) => d.me)) return null;
  const word = STATS.find((s) => s.key === stat)!.label.toLowerCase();
  const avgName = GROUPS.find((g) => g.key === group)!.avg;
  const rows = data.map((d) => ({ label: d.label, boxScore: d.boxScore, mine: d.me ? d.me[stat] : null, mates: d.mates?.[group]?.[stat] ?? null }));
  type Row = (typeof rows)[number];
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  const mineText = (r: Row) => (r.mine != null ? String(r.mine) : r.boxScore === false ? "No box score" : "Didn't play");
  return (
    <ChartFrame
      title="You vs teammates"
      label={`Your ${word} per game night against the average teammate`}
      legend={[
        { name: `Your ${word}`, color: ME },
        { name: avgName, color: MATES, dashed: true },
      ]}
      table={{
        head: ["Night", `You (${word})`, avgName],
        rows: [...rows].reverse().map((r) => [r.label, r.mine ?? "–", r.mates ?? "–"]),
      }}
    >
      <div className="mt-1 mb-2 flex flex-col gap-1.5">
        <Chips items={STATS} value={stat} onChange={setStat} />
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-fg)]">
          <span>vs</span>
          <Chips items={GROUPS} value={group} onChange={setGroup} />
        </div>
      </div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickFormatter={short}
              tick={{ fill: AXIS, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              padding={{ left: 12, right: 12 }}
            />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)" }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Row | undefined;
                if (!active || !r) return null;
                return (
                  <ChartTooltip
                    title={r.label}
                    rows={[
                      { name: `Your ${word}`, value: mineText(r), color: ME },
                      { name: avgName, value: r.mates == null ? "–" : String(r.mates), color: MATES },
                    ]}
                  />
                );
              }}
            />
            <Line
              dataKey="mates"
              name={avgName}
              type="linear"
              stroke={MATES}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: MATES, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="mine"
              name={`Your ${word}`}
              type="linear"
              stroke={ME}
              strokeWidth={2}
              dot={{ r: 4, fill: ME, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: ME, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

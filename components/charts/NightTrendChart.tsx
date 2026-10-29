"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, THEM, US } from "@/components/charts/palette";
import type { NightPoint } from "@/lib/stats/trends";

export function NightTrendChart({ data }: { data: NightPoint[] }) {
  if (!data.length) return null;
  const last = data.length - 1;
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  return (
    <ChartFrame
      title="Goals per game night"
      label="Goals for and against per game night"
      legend={[
        { name: "Goals for", color: US },
        { name: "Goals against", color: THEM },
      ]}
      table={{ head: ["Night", "Record", "GF-GA"], rows: [...data].reverse().map((d) => [d.label, `${d.wins}-${d.losses}`, `${d.goalsFor}-${d.goalsAgainst}`]) }}
    >
      {data.length < 2 && <p className="mb-1 text-[11px] text-[var(--muted-fg)]">Trends appear after a few game nights.</p>}
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 16, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickFormatter={short} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as NightPoint | undefined;
                if (!active || !d) return null;
                return (
                  <ChartTooltip
                    title={`${d.label} · ${d.wins}-${d.losses}`}
                    rows={[
                      { name: "Goals for", value: String(d.goalsFor), color: US },
                      { name: "Goals against", value: String(d.goalsAgainst), color: THEM },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="goalsFor" name="Goals for" fill={US} radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="goalsFor" content={(p) => (p.index === last ? <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 4} textAnchor="middle" fill="#e8f1ff" fontSize={10}>{String(p.value)}</text> : null)} />
            </Bar>
            <Bar dataKey="goalsAgainst" name="Goals against" fill={THEM} radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="goalsAgainst" content={(p) => (p.index === last ? <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 4} textAnchor="middle" fill="#e8f1ff" fontSize={10}>{String(p.value)}</text> : null)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

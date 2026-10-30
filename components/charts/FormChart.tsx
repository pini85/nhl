"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, US } from "@/components/charts/palette";
import type { FormPoint } from "@/lib/stats/trends";

type Tick = { x?: number | string; y?: number | string; payload?: { index: number } };

// W/L/OTL under each bar, in win/loss/OTL text colors.
function renderOutcomeTick({ x = 0, y = 0, payload }: Tick, data: FormPoint[]) {
  const [px, py] = [Number(x), Number(y)];
  const d = data[payload?.index ?? 0];
  return (
    <text x={px} y={py + 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={d?.outcome === "W" ? "#5dffa8" : d?.overtime ? "#ffd27a" : "#ff7a8a"}>
      {d?.outcome === "L" && d.overtime ? "OTL" : d?.outcome}
    </text>
  );
}

export function FormChart({ data }: { data: FormPoint[] }) {
  if (!data.length) return null;
  return (
    <ChartFrame
      title={`Form · last ${data.length} games`}
      label="Points per game, last games"
      table={{ head: ["Game", "Result", "G-A-P"], rows: [...data].reverse().map((d) => [d.label, d.outcome === "L" && d.overtime ? "OTL" : d.outcome, `${d.goals}-${d.assists}-${d.points}`]) }}
    >
      {data.length < 2 && <p className="mb-1 text-[11px] text-[var(--muted-fg)]">Trends appear after a few games.</p>}
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map((d, index) => ({ ...d, index }))} barCategoryGap="25%" margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="index" tick={(p) => renderOutcomeTick(p as Tick, data)} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as FormPoint | undefined;
                if (!active || !d) return null;
                return <ChartTooltip title={`${d.label} · ${d.outcome}`} rows={[{ name: "Points", value: `${d.points} (${d.goals}G ${d.assists}A)`, color: US }]} />;
              }}
            />
            <Bar dataKey="points" name="Points" fill={US} radius={[4, 4, 0, 0]} maxBarSize={24} minPointSize={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

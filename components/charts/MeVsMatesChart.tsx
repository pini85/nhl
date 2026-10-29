"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, MATES, ME } from "@/components/charts/palette";
import type { NightPoint } from "@/lib/stats/trends";

const SURFACE = "#0d1424";

/** The picked player's goals per night against the average teammate skater. */
export function MeVsMatesChart({ data }: { data: NightPoint[] }) {
  if (!data.some((d) => d.myGoals != null)) return null;
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  const show = (v: number | null | undefined, none: string) => (v == null ? none : String(v));
  return (
    <ChartFrame
      title="You vs teammates"
      label="Your goals per game night against the average teammate"
      legend={[
        { name: "Your goals", color: ME },
        { name: "Teammate avg", color: MATES, dashed: true },
      ]}
      table={{
        head: ["Night", "You", "Teammate avg"],
        rows: [...data].reverse().map((d) => [d.label, show(d.myGoals, "–"), show(d.teammateAvg, "–")]),
      }}
    >
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickFormatter={short} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" padding={{ left: 12, right: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)" }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as NightPoint | undefined;
                if (!active || !d) return null;
                return (
                  <ChartTooltip
                    title={d.label}
                    rows={[
                      { name: "Your goals", value: show(d.myGoals, "Didn't play"), color: ME },
                      { name: "Teammate avg", value: show(d.teammateAvg, "–"), color: MATES },
                    ]}
                  />
                );
              }}
            />
            <Line
              dataKey="teammateAvg"
              name="Teammate avg"
              type="monotone"
              stroke={MATES}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: MATES, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="myGoals"
              name="Your goals"
              type="monotone"
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

"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, MATES, ME } from "@/components/charts/palette";
import { Chips } from "@/components/club/Leaders";
import type { MateGroup, NightPoint, StatKey, Teammate } from "@/lib/stats/trends";

const SURFACE = "#0d1424";
const AVG = "__avg";
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

/** The picked player's goals, assists or points per night against one teammate or a group average. */
export function MeVsMatesChart({ data, teammates, myRole = "all" }: { data: NightPoint[]; teammates: Teammate[]; myRole?: MateGroup }) {
  const [stat, setStat] = useState<StatKey>("goals");
  const [group, setGroup] = useState<MateGroup>(myRole);
  const [pick, setPick] = useState<string>(AVG);
  if (!data.some((d) => d.me)) return null;

  const word = STATS.find((s) => s.key === stat)!.label.toLowerCase();
  const inGroup = teammates.filter((t) => group === "all" || t.role === group);
  const player = inGroup.find((t) => t.id === pick);
  const otherName = player ? player.name : GROUPS.find((g) => g.key === group)!.avg;
  const rows = data.map((d) => ({
    label: d.label,
    boxScore: d.boxScore,
    mine: d.me ? d.me[stat] : null,
    other: player ? (d.others?.[player.id]?.[stat] ?? null) : (d.mates?.[group]?.[stat] ?? null),
  }));
  type Row = (typeof rows)[number];
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  const missing = (r: Row, who: "me" | "other") =>
    r.boxScore === false ? "No box score" : who === "me" || player ? "Didn't play" : "–";
  const pickGroup = (g: MateGroup) => {
    setGroup(g);
    setPick(AVG);
  };

  return (
    <ChartFrame
      title="You vs teammates"
      label={`Your ${word} per game night against ${otherName}`}
      legend={[
        { name: `Your ${word}`, color: ME },
        { name: otherName, color: MATES, dashed: !player },
      ]}
      table={{
        head: ["Night", `You (${word})`, otherName],
        rows: [...rows].reverse().map((r) => [r.label, r.mine ?? "–", r.other ?? "–"]),
      }}
    >
      <div className="mt-1 mb-2 flex flex-col gap-1.5">
        <Chips items={STATS} value={stat} onChange={setStat} />
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-fg)]">
          <span>vs</span>
          <Chips items={GROUPS} value={group} onChange={pickGroup} />
        </div>
        <div className="no-scrollbar -mx-3.5 overflow-x-auto px-3.5 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
          <Chips items={[{ key: AVG, label: "Average" }, ...inGroup.map((t) => ({ key: t.id, label: t.name }))]} value={pick} onChange={setPick} />
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
                      { name: `Your ${word}`, value: r.mine == null ? missing(r, "me") : String(r.mine), color: ME },
                      { name: otherName, value: r.other == null ? missing(r, "other") : String(r.other), color: MATES },
                    ]}
                  />
                );
              }}
            />
            <Line
              dataKey="other"
              name={otherName}
              type="linear"
              stroke={MATES}
              strokeWidth={2}
              strokeDasharray={player ? undefined : "5 4"}
              dot={player ? { r: 3, fill: MATES, stroke: SURFACE, strokeWidth: 2 } : false}
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

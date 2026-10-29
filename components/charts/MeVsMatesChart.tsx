"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, MATES, ME } from "@/components/charts/palette";
import { Chips } from "@/components/club/Leaders";
import type { MateGroup, NightPoint, StatKey, Teammate } from "@/lib/stats/trends";

const SURFACE = "#0d1424";
const AVG = "__avg";
const X_PAD = 12;
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
  const [nightKey, setNightKey] = useState<string | undefined>(data.at(-1)?.key);
  if (!data.some((d) => d.me)) return null;

  // Names are the teammates who played the selected night, in that night's role.
  const night = data.find((d) => d.key === nightKey) ?? data.at(-1)!;
  const order = new Map(teammates.map((t, i) => [t.id, i]));
  const nameOf = new Map(teammates.map((t) => [t.id, t.name]));
  const inGroup = Object.keys(night.others ?? {})
    .filter((id) => group === "all" || night.roles?.[id] === group)
    .sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
    .map((id) => ({ id, name: nameOf.get(id) ?? id }));

  const word = STATS.find((s) => s.key === stat)!.label.toLowerCase();
  // A picked teammate stays picked when you tap a night they sat out.
  const player = inGroup.find((t) => t.id === pick) ?? (nameOf.has(pick) ? { id: pick, name: nameOf.get(pick)! } : undefined);
  const chips = player && !inGroup.includes(player) ? [...inGroup, player] : inGroup;
  const otherName = player ? player.name : GROUPS.find((g) => g.key === group)!.avg;
  const rows = data.map((d) => ({
    key: d.key,
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
        <p className="text-[10px] text-[var(--muted-fg)]">
          Played {night.label} · tap a night on the chart to change
        </p>
        <div className="no-scrollbar -mx-3.5 overflow-x-auto px-3.5 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
          <Chips
            items={[{ key: AVG, label: "Average" }, ...chips.map((t) => ({ key: t.id, label: t.name }))]}
            value={player ? pick : AVG}
            onChange={setPick}
          />
        </div>
      </div>
      <div
        className="h-[150px]"
        onClick={(e) => {
          // Pick the night nearest the tap. Phone taps carry no hover state, so read the plot area from the DOM.
          const plot = e.currentTarget.querySelector(".recharts-cartesian-grid")?.getBoundingClientRect();
          if (!plot || rows.length === 0) return;
          const inner = plot.width - 2 * X_PAD;
          const i = rows.length === 1 ? 0 : Math.round(((e.clientX - plot.left - X_PAD) / inner) * (rows.length - 1));
          const row = rows[Math.min(rows.length - 1, Math.max(0, i))];
          if (row) setNightKey(row.key);
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <ReferenceLine x={night.label} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 3" />
            <XAxis
              dataKey="label"
              tickFormatter={short}
              tick={{ fill: AXIS, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              padding={{ left: X_PAD, right: X_PAD }}
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

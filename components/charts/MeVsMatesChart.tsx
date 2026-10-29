"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, MATES, ME } from "@/components/charts/palette";
import { Chips } from "@/components/club/Leaders";
import type { MateGroup, NightPoint, StatKey, StatLine, Teammate } from "@/lib/stats/trends";
import { cn } from "@/lib/utils";

const SURFACE = "#0d1424";
const X_PAD = 12;
const STATS: { key: StatKey; label: string; short: string }[] = [
  { key: "goals", label: "Goals", short: "G" },
  { key: "assists", label: "Assists", short: "A" },
  { key: "points", label: "Points", short: "P" },
];
const GROUPS: { key: MateGroup; label: string }[] = [
  { key: "all", label: "All" },
  { key: "forwards", label: "Forwards" },
  { key: "defense", label: "Defense" },
];

type NightRow = { id: string; name: string; you: boolean; stats: StatLine };

/** The picked player's goals, assists or points per night against one teammate, plus who played the selected night. */
export function MeVsMatesChart({
  data,
  teammates,
  myName,
  myRole = "all",
}: {
  data: NightPoint[];
  teammates: Teammate[];
  myName: string;
  myRole?: MateGroup;
}) {
  const [stat, setStat] = useState<StatKey>("goals");
  const [group, setGroup] = useState<MateGroup>(myRole);
  const [pick, setPick] = useState<string | null>(null);
  const [nightKey, setNightKey] = useState<string | undefined>(data.at(-1)?.key);
  if (!data.some((d) => d.me)) return null;

  const word = STATS.find((s) => s.key === stat)!.label.toLowerCase();
  const nameOf = new Map(teammates.map((t) => [t.id, t.name]));

  // Everyone who played the selected night (in the chosen group), best first for the chosen stat.
  const night = data.find((d) => d.key === nightKey) ?? data.at(-1)!;
  const byStat = (a: NightRow, b: NightRow) => b.stats[stat] - a.stats[stat] || b.stats.points - a.stats.points || a.name.localeCompare(b.name);
  const mates: NightRow[] = Object.entries(night.others ?? {})
    .filter(([id]) => group === "all" || night.roles?.[id] === group)
    .map(([id, stats]) => ({ id, name: nameOf.get(id) ?? id, you: false, stats }))
    .sort(byStat);
  const list = (night.me ? [...mates, { id: "", name: myName, you: true, stats: night.me }] : mates).sort(byStat);

  // The comparison line: the teammate you tapped (stays picked across nights), else that night's top teammate.
  const compareId = pick && nameOf.has(pick) ? pick : mates[0]?.id;
  const compareName = compareId ? (nameOf.get(compareId) ?? compareId) : null;

  const rows = data.map((d) => ({
    key: d.key,
    label: d.label,
    boxScore: d.boxScore,
    mine: d.me ? d.me[stat] : null,
    other: compareId ? (d.others?.[compareId]?.[stat] ?? null) : null,
  }));
  type Row = (typeof rows)[number];
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  const missing = (r: Row) => (r.boxScore === false ? "No box score" : "Didn't play");

  return (
    <ChartFrame
      title="You vs teammates"
      label={`Your ${word} per game night${compareName ? ` against ${compareName}` : ""}`}
      legend={[{ name: `Your ${word}`, color: ME }, ...(compareName ? [{ name: compareName, color: MATES }] : [])]}
      table={{
        head: ["Night", `You (${word})`, ...(compareName ? [compareName] : [])],
        rows: [...rows].reverse().map((r) => [r.label, r.mine ?? "–", ...(compareName ? [r.other ?? "–"] : [])]),
      }}
    >
      <div className="mt-1 mb-2 flex flex-col gap-1.5">
        <Chips items={STATS} value={stat} onChange={setStat} />
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-fg)]">
          <span>vs</span>
          <Chips items={GROUPS} value={group} onChange={setGroup} />
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
                      { name: `Your ${word}`, value: r.mine == null ? missing(r) : String(r.mine), color: ME },
                      ...(compareName ? [{ name: compareName, value: r.other == null ? missing(r) : String(r.other), color: MATES }] : []),
                    ]}
                  />
                );
              }}
            />
            {compareName && (
              <Line
                dataKey="other"
                name={compareName}
                type="linear"
                stroke={MATES}
                strokeWidth={2}
                dot={{ r: 3, fill: MATES, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 4, fill: MATES, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
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

      <div className="mt-3 border-t border-[var(--card-border)] pt-2">
        <p className="mb-1 text-[10px] text-[var(--muted-fg)]">
          {night.label} · {night.boxScore === false ? "no box score" : `${list.length} played`} · tap a night to change, a player to compare
        </p>
        {list.length > 0 && (
          <table className="tabular w-full text-xs">
            <thead>
              <tr className="text-[10px] text-[var(--muted-fg)]">
                <th className="py-1 text-left font-medium">Player</th>
                {STATS.map((s) => (
                  <th key={s.key} className={cn("w-9 py-1 text-right font-medium", s.key === stat && "text-[var(--fg)]")}>
                    {s.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const comparing = !p.you && p.id === compareId;
                return (
                  <tr
                    key={p.id || "you"}
                    onClick={p.you ? undefined : () => setPick(p.id)}
                    className={cn(!p.you && "cursor-pointer", (p.you || comparing) && "bg-white/[0.05]")}
                  >
                    <td className="py-1.5 pl-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: p.you ? ME : comparing ? MATES : "transparent" }}
                          aria-hidden
                        />
                        {p.you ? (
                          <span className="font-semibold">{p.name}</span>
                        ) : (
                          <button type="button" aria-pressed={comparing} className="text-left">
                            {p.name}
                          </button>
                        )}
                        {p.you && <span className="text-[10px] text-[var(--muted-fg)]">you</span>}
                      </span>
                    </td>
                    {STATS.map((s) => (
                      <td key={s.key} className={cn("py-1.5 text-right", s.key === stat ? "font-bold text-[var(--fg)]" : "text-[var(--muted-fg)]")}>
                        {p.stats[s.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ChartFrame>
  );
}

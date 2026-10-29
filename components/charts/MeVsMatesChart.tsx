"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, COMPARE, GRID, ME } from "@/components/charts/palette";
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

/** The picked player's goals, assists or points per night against up to three teammates, plus who played the selected night. */
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
  // One slot per comparison line, so a player keeps their color while others come and go. Null = not chosen yet.
  const [slots, setSlots] = useState<(string | null)[] | null>(null);
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

  // Comparison lines: the teammates you tapped (they stay across nights), else that night's top teammate.
  const current = (slots ?? [mates[0]?.id ?? null, null, null]).map((id) => (id && nameOf.has(id) ? id : null));
  const compared = current.flatMap((id, slot) => (id ? [{ id, slot, name: nameOf.get(id)!, ...COMPARE[slot] }] : []));
  const slotOf = (id: string) => current.indexOf(id);
  const toggle = (id: string) => {
    const next = [...current];
    const at = next.indexOf(id);
    if (at >= 0) next[at] = null;
    else {
      const free = next.indexOf(null);
      next[free >= 0 ? free : 0] = id; // all three taken: replace the first
    }
    setSlots(next);
  };

  const rows = data.map((d) => ({
    key: d.key,
    label: d.label,
    boxScore: d.boxScore,
    mine: d.me ? d.me[stat] : null,
    ...Object.fromEntries(compared.map((c) => [`c${c.slot}`, d.others?.[c.id]?.[stat] ?? null])),
  })) as { key: string; label: string; boxScore?: boolean; mine: number | null; [slot: string]: unknown }[];
  type Row = (typeof rows)[number];
  const short = (label: string) => label.split(" ").slice(1).join(" "); // "Thu Oct 22" → "Oct 22"
  const missing = (r: Row) => (r.boxScore === false ? "No box score" : "Didn't play");

  return (
    <ChartFrame
      title="You vs teammates"
      label={`Your ${word} per game night${compared.length ? ` against ${compared.map((c) => c.name).join(", ")}` : ""}`}
      legend={[{ name: `Your ${word}`, color: ME }, ...compared.map((c) => ({ name: c.name, color: c.color, dashed: c.dashed }))]}
      table={{
        head: ["Night", `You (${word})`, ...compared.map((c) => c.name)],
        rows: [...rows].reverse().map((r) => [r.label, r.mine ?? "–", ...compared.map((c) => (r[`c${c.slot}`] as number | null) ?? "–")]),
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
                      ...compared.map((c) => {
                        const v = r[`c${c.slot}`] as number | null;
                        return { name: c.name, value: v == null ? missing(r) : String(v), color: c.color };
                      }),
                    ]}
                  />
                );
              }}
            />
            {compared.map((c) => (
              <Line
                key={c.slot}
                dataKey={`c${c.slot}`}
                name={c.name}
                type="linear"
                stroke={c.color}
                strokeWidth={2}
                strokeDasharray={c.dashed ? "5 4" : undefined}
                dot={{ r: 3, fill: c.color, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 4, fill: c.color, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
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
          {night.label} · {night.boxScore === false ? "no box score" : `${list.length} played`} · tap a night or up to 3 players
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
                const slot = p.you ? -1 : slotOf(p.id);
                const comparing = slot >= 0;
                return (
                  <tr
                    key={p.id || "you"}
                    onClick={p.you ? undefined : () => toggle(p.id)}
                    className={cn(!p.you && "cursor-pointer", (p.you || comparing) && "bg-white/[0.05]")}
                  >
                    <td className="py-1.5 pl-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: p.you ? ME : comparing ? COMPARE[slot].color : "transparent" }}
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

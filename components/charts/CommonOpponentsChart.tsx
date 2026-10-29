"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/ChartFrame";
import { AXIS, GRID, THEM, US } from "@/components/charts/palette";

export type CommonOpponentPoint = {
  name: string;
  them: { gp: number; goalsFor: number; goalsAgainst: number; diffPerGame: number };
  us: { gp: number; goalsFor: number; goalsAgainst: number; diffPerGame: number };
};

const signed = (n: number) => `${n > 0 ? "+" : ""}${Number.isInteger(n) ? n : n.toFixed(1)}`;
const detail = (s: CommonOpponentPoint["them"]) => `${signed(s.diffPerGame)}/game · ${s.goalsFor}-${s.goalsAgainst} in ${s.gp}`;
const short = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

type Tick = { x?: number | string; y?: number | string; payload?: { value: string } };

// One line per club; Recharts would otherwise wrap long names onto two.
function ClubTick({ x = 0, y = 0, payload }: Tick) {
  return (
    <text x={Number(x) - 4} y={Number(y)} dy={3} textAnchor="end" fontSize={10} fill={AXIS}>
      <title>{payload?.value}</title>
      {short(payload?.value ?? "")}
    </text>
  );
}

// Goal difference per game against the clubs both teams played: theirs next to ours.
export function CommonOpponentsChart({ opponentName, data }: { opponentName: string; data: CommonOpponentPoint[] }) {
  if (!data.length) return null;
  const rows = data.map((d) => ({ ...d, themDiff: d.them.diffPerGame, usDiff: d.us.diffPerGame }));
  const max = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.themDiff), Math.abs(r.usDiff)]));
  const bound = Math.ceil(max);

  return (
    <ChartFrame
      title="Same opponents · goal diff per game"
      label={`Goal difference per game: ${opponentName} and us against the same clubs`}
      legend={[
        { name: "Them", color: THEM },
        { name: "Us", color: US },
      ]}
      table={{
        head: ["Club", "Them", "Us"],
        rows: data.map((d) => [d.name, detail(d.them), detail(d.us)]),
      }}
    >
      <p className="mb-1 text-[11px] text-[var(--muted-fg)]">Right of the line = won by more. Bigger gap = one team did better.</p>
      <div style={{ height: rows.length * 40 + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" barCategoryGap="22%" barGap={2} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis
              type="number"
              domain={[-bound, bound]}
              allowDecimals={false}
              tickFormatter={(v: number) => signed(v)}
              tick={{ fill: AXIS, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              interval={0}
              tick={(p) => <ClubTick {...(p as Tick)} />}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke={AXIS} strokeOpacity={0.6} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as CommonOpponentPoint | undefined;
                if (!active || !d) return null;
                return (
                  <ChartTooltip
                    title={`vs ${d.name}`}
                    rows={[
                      { name: "Them", value: detail(d.them), color: THEM },
                      { name: "Us", value: detail(d.us), color: US },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="themDiff" name="Them" fill={THEM} radius={[0, 4, 4, 0]} maxBarSize={12} minPointSize={2} />
            <Bar dataKey="usDiff" name="Us" fill={US} radius={[0, 4, 4, 0]} maxBarSize={12} minPointSize={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

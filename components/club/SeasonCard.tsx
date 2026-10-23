import { GrowBar } from "@/components/club/FadeIn";
import { ResultPill } from "@/components/club/ResultPill";
import { WhatIf } from "@/components/club/WhatIf";
import { MAX_POINTS, SEASON_GAMES } from "@/lib/divisions";
import type { SeasonProgress } from "@/lib/stats/season";

const pct = (n: number) => Math.min(100, (n / MAX_POINTS) * 100);

function Tick({ at, label, reached }: { at: number; label: string; reached: boolean }) {
  return (
    <div className="absolute -top-1 -bottom-1 w-0.5" style={{ left: `${pct(at)}%`, background: reached ? "var(--win-fg)" : "var(--fg)", opacity: 0.8 }}>
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap" style={{ color: reached ? "var(--win-fg)" : undefined }}>
        {label}
      </span>
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold opacity-60">{at}</span>
    </div>
  );
}

export function SeasonCard({ season, seasonResults }: { season: SeasonProgress; seasonResults: string[] }) {
  const d = season.division;
  const played = seasonResults.filter((r) => r === "wins" || r === "losses" || r === "otl").reverse(); // oldest first
  const slots = Array.from({ length: SEASON_GAMES }, (_, i) => played[i] ?? null);
  const record = `${season.wins}W · ${season.losses}L${season.otl ? ` · ${season.otl} OTL` : ""}`;

  return (
    <section className="arena-card my-3 p-3.5" style={{ borderColor: "rgba(92,200,255,.4)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">
          This season{d ? ` · Div ${d.id} · ${d.conference}` : ""}
        </h2>
        <span className="text-[11px] text-[var(--muted-fg)]">
          {season.gp} / {SEASON_GAMES} GP
        </span>
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <span className="glow tabular text-4xl font-black text-[var(--accent-blue)]">{season.points}</span>
          <span className="text-xs text-[var(--muted-fg)]"> pts</span>
        </div>
        <div className="text-right text-xs">
          <b>{record}</b>
          <br />
          <span className="text-[var(--muted-fg)]">{season.remaining} games left</span>
        </div>
      </div>

      <div className="relative mt-7 mb-6 h-2.5 rounded-md bg-white/[0.08]">
        <div
          className="absolute inset-y-0 rounded-r-md bg-[rgba(92,200,255,0.12)]"
          style={{ left: `${pct(season.points)}%`, width: `${pct(season.maxPoints) - pct(season.points)}%` }}
        />
        <GrowBar
          percent={pct(season.points)}
          className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-[#1e88e5] to-[var(--accent-blue)] shadow-[0_0_12px_rgba(92,200,255,0.6)]"
        />
        {d && d.hold > 0 && <Tick at={d.hold} label={season.safeReached ? "✓" : "🛡"} reached={season.safeReached} />}
        {d && d.promotion < d.title && <Tick at={d.promotion} label="⬆" reached={season.points >= d.promotion} />}
        {d && <Tick at={d.title} label="🏆" reached={season.points >= d.title} />}
      </div>

      {season.outlook && <p className="text-xs font-medium text-[var(--accent-blue)]">{season.outlook}</p>}
      {d && (
        <p className="mt-0.5 text-[10px] text-[var(--muted-fg)]">
          {d.hold > 0 ? `🛡 Safe ${d.hold} · ` : ""}
          {d.promotion < d.title ? `⬆ Promotion ${d.promotion} · ` : ""}🏆 Title {d.title}
        </p>
      )}

      <div className="mt-2.5 flex gap-1">
        {slots.map((r, i) => (
          <ResultPill key={i} outcome={r === "wins" ? "W" : r === "losses" ? "L" : r === "otl" ? "OTL" : null} className="min-w-0 flex-1" />
        ))}
      </div>
      {d && <WhatIf seasonResults={seasonResults} division={d.id} />}
    </section>
  );
}

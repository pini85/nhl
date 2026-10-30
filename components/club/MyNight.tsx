import Link from "next/link";
import { Section } from "@/components/club/Section";
import { StatTile } from "@/components/club/StatTile";
import type { LastNight, Streak } from "@/lib/stats/personal";
import { formatRecord } from "@/lib/stats/record";

const STREAK: Record<Streak["key"], string> = { points: "games in a row with a point", goals: "games in a row with a goal", games: "games in a row played" };

/** Me tab: your latest game night and the streaks you have going. */
export function MyNight({ night, streaks }: { night: LastNight | null; streaks: Streak[] }) {
  return (
    <>
      {night && (
        <Section
          title="Your last game night"
          right={
            <Link href={`/nights/${night.nightKey}`} className="text-[11px] text-[var(--accent-blue)]">
              {night.label} →
            </Link>
          }
        >
          <div className="grid grid-cols-4 gap-1.5">
            <StatTile label="GP" value={night.gp} />
            {night.goalie && night.goals + night.assists === 0 ? (
              <>
                <StatTile label="Saves" value={`${night.goalie.saves}/${night.goalie.shots}`} glow />
                <StatTile label="SV%" value={night.goalie.shots ? (night.goalie.saves / night.goalie.shots).toFixed(3).replace(/^0/, "") : "–"} />
              </>
            ) : (
              <>
                <StatTile label="Goals" value={night.goals} glow />
                <StatTile label="Assists" value={night.assists} />
              </>
            )}
            <StatTile label={night.otLosses ? "W-L-OTL" : "W-L"} value={formatRecord(night)} />
          </div>
          {night.pointsVsAvg !== null && (
            <p className="mt-2 text-xs text-[var(--muted-fg)]">
              {Math.abs(night.pointsVsAvg) < 0.05
                ? "Right on your usual points per game."
                : `${Math.abs(night.pointsVsAvg).toFixed(1)} points per game ${night.pointsVsAvg > 0 ? "above" : "below"} your average.`}
            </p>
          )}
        </Section>
      )}
      {streaks.length > 0 && (
        <Section title="Streaks">
          <ul className="space-y-1.5 text-sm">
            {streaks.map((s) => (
              <li key={s.key}>
                🔥 <b className="tabular">{s.length}</b> {STREAK[s.key]}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

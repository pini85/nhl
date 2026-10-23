import Link from "next/link";
import { ResultPill } from "@/components/club/ResultPill";
import { Section } from "@/components/club/Section";
import { WhenLabel } from "@/components/club/WhenLabel";
import type { GameNight } from "@/lib/stats/nights";

export function LatestNight({
  night,
  mvp,
}: {
  night: GameNight;
  mvp: { playerName: string; goals: number; assists: number; points: number } | null;
}) {
  const last = night.games[0];
  return (
    <Section
      title={undefined}
      right={undefined}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">
          <WhenLabel lastIso={last.playedAt.toISOString()} recent="Tonight" fallback={`Last game night · ${night.label}`} />
        </h2>
        <span className="tabular text-sm font-extrabold">
          <span className="text-[var(--win-fg)]">{night.wins}W</span> · <span className="text-[var(--loss-fg)]">{night.losses}L</span>
        </span>
      </div>

      <Link href={`/games/${last.matchId}`} className="mt-2 block rounded-xl bg-white/[0.04] p-3 active:bg-white/[0.08]">
        <div className="flex items-center justify-between text-[15px]">
          <b>Drop drop drop</b>
          <b className="tabular text-2xl">{last.goalsFor}</b>
        </div>
        <div className="flex items-center justify-between text-[15px] text-[var(--muted-fg)]">
          <span>{last.opponentName ?? `Club ${last.opponentClubId}`}</span>
          <b className="tabular text-2xl">{last.goalsAgainst}</b>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--muted-fg)]">
          <ResultPill outcome={last.outcome} overtime={last.overtime} dnf={last.dnf} /> Latest game · tap for box score
        </div>
      </Link>

      <Link href={`/nights/${night.key}`} className="mt-2 inline-block text-xs font-semibold text-[var(--accent-blue)]">
        Night recap →
      </Link>
      {mvp && mvp.points > 0 && (
        <p className="mt-2 text-xs text-[var(--muted-fg)]">
          ⭐ Night MVP <b className="text-[var(--fg)]">{mvp.playerName}</b> · {mvp.goals}G {mvp.assists}A
        </p>
      )}
    </Section>
  );
}

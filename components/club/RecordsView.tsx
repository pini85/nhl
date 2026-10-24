import Link from "next/link";
import { Section } from "@/components/club/Section";
import type { Milestone, RecordItem } from "@/lib/stats/records";

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", month: "short", day: "numeric" });

const ICON: Record<string, string> = {
  "goals-game": "🥅",
  "assists-game": "🎯",
  "points-game": "⭐",
  "hits-game": "💥",
  "shots-game": "🏒",
  "team-goals-game": "🚨",
  "biggest-win": "📈",
  "win-streak": "🔥",
  "point-streak": "📊",
  "takeaways-game": "🕵️",
  "interceptions-game": "🦅",
  "blocks-game": "🛡️",
  "pass-pct-game": "📬",
};

export function RecordsView({
  records,
  streak,
  milestones,
}: {
  records: RecordItem[];
  streak: { kind: "W" | "L"; length: number } | null;
  milestones: Milestone[];
}) {
  return (
    <>
      {streak && (
        <div className="arena-card mt-3 flex items-center justify-between px-3.5 py-3">
          <span className="text-sm text-[var(--muted-fg)]">Current streak</span>
          <b className="tabular text-lg" style={{ color: streak.kind === "W" ? "var(--win-fg)" : "var(--loss-fg)" }}>
            {streak.length} {streak.kind === "W" ? (streak.length === 1 ? "win" : "wins") : streak.length === 1 ? "loss" : "losses"}
          </b>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {records.map((r) => {
          const body = (
            <>
              <div className="text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">
                {ICON[r.key]} {r.label}
              </div>
              <div className="glow tabular mt-1 text-3xl font-black text-[var(--accent-blue)]">
                {r.value}
                {r.key === "pass-pct-game" ? "%" : ""}
              </div>
              <div className="mt-0.5 truncate text-xs" data-player-id={r.holderId ?? undefined}>
                {r.holder ?? "Drop drop drop"}
              </div>
              <div className="text-[10px] text-[var(--muted-fg)]">{dayFmt.format(r.playedAt)}</div>
            </>
          );
          return r.matchId ? (
            <Link key={r.key} href={`/games/${r.matchId}`} className="arena-card block p-3 active:bg-white/[0.06]">
              {body}
            </Link>
          ) : (
            <div key={r.key} className="arena-card p-3">
              {body}
            </div>
          );
        })}
      </div>

      {milestones.length > 0 && (
        <Section title="Milestones">
          <ol className="relative ml-2 border-l border-[var(--card-border)]">
            {[...milestones].reverse().map((m) => (
              <li key={m.label} className="mb-3 ml-4 last:mb-0">
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-[var(--accent-blue)]" aria-hidden />
                <Link href={`/games/${m.matchId}`} className="text-sm font-semibold">
                  {m.label}
                </Link>
                <div className="text-[11px] text-[var(--muted-fg)]">
                  {m.holder && m.holderId ? (
                    <>
                      <Link href={`/players/${m.holderId}`}>{m.holder}</Link>
                      {" · "}
                    </>
                  ) : m.holder ? (
                    `${m.holder} · `
                  ) : (
                    ""
                  )}
                  {dayFmt.format(m.reachedAt)}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

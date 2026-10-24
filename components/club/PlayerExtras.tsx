import Link from "next/link";
import { Section } from "@/components/club/Section";
import type { NextMilestone, VsRow } from "@/lib/stats/personal";
import type { RecordItem } from "@/lib/stats/records";

type Props = {
  you: boolean;
  milestones: NextMilestone[];
  standing: { held: RecordItem[]; nearMisses: { record: RecordItem; best: number; short: number }[] };
  vs: { skater: VsRow[] | null; goalie: VsRow[] | null };
  teammates: { eaPlayerId: string; name: string; gp: number; winPct: number }[];
};

const STAT_WORD: Record<NextMilestone["stat"], string> = { games: "games", goals: "goals", assists: "assists", points: "points", hits: "hits" };

/** Milestones, records, vs-team and best teammates. Worded for "you" on the Me tab. */
export function PlayerExtras({ you, milestones, standing, vs, teammates }: Props) {
  const rows = [...(vs.skater ?? []), ...(vs.goalie ?? [])];
  return (
    <>
      {milestones.length > 0 && (
        <Section title={you ? "Your next milestones" : "Next milestones"}>
          <ul className="space-y-2.5">
            {milestones.map((m) => (
              <li key={m.stat}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    <b className="tabular text-[var(--accent-blue)]">{m.remaining}</b> {STAT_WORD[m.stat]} to {m.target}
                  </span>
                  <span className="tabular text-[11px] text-[var(--muted-fg)]">
                    {m.target - m.remaining}/{m.target}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${((m.target - m.remaining) / m.target) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(standing.held.length > 0 || standing.nearMisses.length > 0) && (
        <Section title={you ? "Your records" : "Records"}>
          <ul className="space-y-1.5 text-sm">
            {standing.held.map((r) => (
              <li key={r.key} className="flex justify-between gap-2">
                <span>🏆 {r.label}</span>
                <b className="tabular text-[var(--accent-blue)]">{r.value}</b>
              </li>
            ))}
            {standing.nearMisses.map(({ record, short }) => (
              <li key={record.key} className="flex justify-between gap-2 text-[var(--muted-fg)]">
                <span>
                  {short} short of {record.label.replace(/^Most /, "most ").replace(/^Best /, "best ")}
                </span>
                <span className="tabular">{record.value}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {rows.length > 0 && (
        <Section title={you ? "You vs the team" : "Vs the team"} right={<span className="text-[10px] text-[var(--muted-fg)]">per game</span>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">
                <th className="py-1 text-left font-medium" />
                <th className="py-1 text-right font-medium">{you ? "You" : "Player"}</th>
                <th className="py-1 text-right font-medium">Team</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ahead = r.better === "higher" ? r.mine > r.team : r.mine < r.team;
                return (
                  <tr key={r.stat} className="border-t border-white/[0.05]">
                    <td className="py-1.5">{r.stat}</td>
                    <td className={`tabular py-1.5 text-right font-semibold ${ahead ? "text-[var(--win-fg)]" : ""}`}>{r.mine}</td>
                    <td className="tabular py-1.5 text-right text-[var(--muted-fg)]">{r.team}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {teammates.length > 0 && (
        <Section title={you ? "Your best teammates" : "Best teammates"}>
          <ul className="space-y-1.5 text-sm">
            {teammates.map((t) => (
              <li key={t.eaPlayerId} className="flex justify-between gap-2">
                <Link href={`/players/${t.eaPlayerId}`} className="font-semibold">
                  {t.name}
                </Link>
                <span className="tabular text-[var(--muted-fg)]">
                  {Math.round(t.winPct * 100)}% wins · {t.gp} games together
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

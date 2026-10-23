"use client";

import Link from "next/link";
import { useState } from "react";
import { LocalTime } from "@/components/club/LocalTime";
import { ResultPill } from "@/components/club/ResultPill";
import { cn } from "@/lib/utils";
import type { GameNight } from "@/lib/stats/nights";

type NightView = GameNight & { mvp: { playerName: string; points: number } | null };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "gameType5", label: "Season" },
  { key: "gameType10", label: "Playoffs" },
  { key: "club_private", label: "Private" },
] as const;

export function GamesBrowser({ nights }: { nights: NightView[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const visible = nights
    .map((n) => ({ ...n, games: filter === "all" ? n.games : n.games.filter((g) => g.matchType === filter) }))
    .filter((n) => n.games.length);

  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              filter === f.key
                ? "border-[var(--accent-blue)] bg-[rgba(92,200,255,0.15)] text-[var(--accent-blue)]"
                : "border-[var(--card-border)] text-[var(--muted-fg)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!visible.length && <p className="py-8 text-center text-sm text-[var(--muted-fg)]">No games of this type yet.</p>}

      {visible.map((night, i) => {
        const w = night.games.filter((g) => g.outcome === "W").length;
        const l = night.games.length - w;
        return (
          <details key={night.key + i} open={i === 0} className="arena-card group my-3 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between p-3.5">
              <div>
                <div className="font-bold">{night.label}</div>
                <div className="text-[11px] text-[var(--muted-fg)]">
                  {night.games.length} {night.games.length === 1 ? "game" : "games"}{night.mvp && night.mvp.points > 0 ? ` · ⭐ ${night.mvp.playerName} ${night.mvp.points} pts` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-lg font-black">
                  <span className="text-[var(--win-fg)]">{w}</span>-<span className="text-[var(--loss-fg)]">{l}</span>
                </div>
                <div className="tabular text-[11px] text-[var(--muted-fg)]">
                  GF {night.games.reduce((s, g) => s + g.goalsFor, 0)} · GA {night.games.reduce((s, g) => s + g.goalsAgainst, 0)}
                </div>
              </div>
            </summary>
            <ul className="border-t border-[var(--card-border)]">
              {night.games.map((g) => (
                <li key={g.matchId}>
                  <Link
                    href={`/games/${g.matchId}`}
                    className="flex items-center gap-3 px-3.5 py-2.5 active:bg-white/[0.05]"
                  >
                    <span className="w-12 shrink-0"><ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} /></span>
                    <span className="tabular w-10 font-bold">
                      {g.goalsFor}-{g.goalsAgainst}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{g.opponentName ?? `Club ${g.opponentClubId}`}</span>
                    {g.source === "summary" ? (
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--muted-fg)]">score only</span>
                    ) : (
                      <span className="text-[11px] text-[var(--muted-fg)]">
                        <LocalTime iso={g.playedAt.toISOString()} />
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}

import { ResultPill } from "@/components/club/ResultPill";
import type { ClubFinals } from "@/lib/stats/finals";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Club finals at a glance, laid out like the season card. */
export function PlayoffsCard({ finals }: { finals: ClubFinals }) {
  const { record, runs } = finals;
  const losses = record.losses + record.otLosses;
  const latest = runs[0];
  const latestGames = latest ? [...latest.games].reverse() : []; // oldest first = round 1 first
  const out = latest && latest.games[0].outcome === "L";

  return (
    <section className="arena-card my-3 p-3.5" style={{ borderColor: "rgba(255,207,90,.4)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">Playoffs · Club finals</h2>
        <span className="text-[11px] text-[var(--muted-fg)]">{plural(finals.games, "game")}</span>
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <span className="glow tabular text-4xl font-black text-[#ffcf5a]">{record.wins}</span>
          <span className="text-xs text-[var(--muted-fg)]"> wins</span>
        </div>
        <div className="text-right text-xs">
          <b>
            {record.wins}W · {losses}L
          </b>
          <br />
          <span className="text-[var(--muted-fg)]">
            {plural(finals.appearances, "appearance")} · {plural(finals.cups, "cup")}
          </span>
        </div>
      </div>

      {!latest ? (
        <p className="mt-4 text-xs text-[var(--muted-fg)]">No club finals games saved yet. They show up here after your next finals run.</p>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-[#ffcf5a]">
            Latest run · {latest.label}: {out ? "out in" : "reached"} round {latest.games.length}
          </p>
          <div className="mt-2 flex gap-1">
            {latestGames.map((g, i) => (
              <div key={g.matchId} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                <ResultPill outcome={g.outcome} overtime={g.overtime} dnf={g.dnf} className="w-full" />
                <span className="text-[9px] text-[var(--muted-fg)]">
                  R{i + 1} · {g.goalsFor}-{g.goalsAgainst}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted-fg)]">
            🏒 {plural(finals.games, "round")} played · furthest: round {finals.furthestRound}
          </p>

          {runs.length > 1 && (
            <div className="mt-3 border-t border-white/[0.06] pt-2">
              <p className="mb-1 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">All runs</p>
              <ul className="space-y-1 text-xs">
                {runs.map((r) => (
                  <li key={r.key} className="flex justify-between">
                    <span>{r.label}</span>
                    <span className="tabular text-[var(--muted-fg)]">
                      {r.wins}W · {r.losses + r.otLosses}L · round {r.games.length}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

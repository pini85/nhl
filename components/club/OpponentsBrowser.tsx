"use client";

import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { requestScout } from "@/app/opponents/actions";
import { OpponentRow, type OpponentRowData } from "@/components/club/OpponentRow";
import { scoutMessage } from "@/components/club/scoutMessages";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "played", label: "Most played" },
  { key: "worst", label: "Worst record" },
] as const;

export function OpponentsBrowser({ clubs, children }: { clubs: OpponentRowData[]; children?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("recent");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const query = q.trim().toLowerCase();
  const matches = query ? clubs.filter((c) => c.name.toLowerCase().includes(query)) : [];

  // The list is clubs we've played; scouted-only clubs show up in search.
  const sorted = clubs.filter((c) => c.gp > 0).sort((a, b) => {
    if (sort === "played") return b.gp - a.gp || (b.lastPlayedIso ?? "").localeCompare(a.lastPlayedIso ?? "");
    if (sort === "worst") {
      const pa = a.gp ? a.wins / a.gp : 2;
      const pb = b.gp ? b.wins / b.gp : 2;
      return pa - pb || a.goalsFor - a.goalsAgainst - (b.goalsFor - b.goalsAgainst);
    }
    return (b.lastPlayedIso ?? "").localeCompare(a.lastPlayedIso ?? "");
  });

  function scout() {
    start(async () => {
      const r = await requestScout(q).catch(() => ({ status: "error" as const }));
      setStatus(scoutMessage(r.status));
    });
  }

  return (
    <>
      <label className="arena-card mt-3 flex items-center gap-2 px-3 py-2.5">
        <Search className="size-4 text-[var(--muted-fg)]" aria-hidden />
        <input
          autoFocus
          inputMode="search"
          enterKeyHint="search"
          placeholder="Search a club…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setStatus(null);
          }}
          className="w-full bg-transparent text-base outline-none placeholder:text-[var(--muted-fg)]"
          aria-label="Search a club"
        />
      </label>

      {query ? (
        <section className="arena-card my-3 overflow-hidden">
          {matches.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {matches.map((c) => (
                <li key={c.clubId}>
                  <OpponentRow o={c} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3.5 text-sm text-[var(--muted-fg)]">No club we know matches “{q.trim()}”.</p>
          )}
          {query.length >= 2 && (
            <div className="border-t border-[var(--card-border)] p-3.5">
              <button
                onClick={scout}
                disabled={pending}
                className="w-full rounded-xl bg-[rgba(92,200,255,0.15)] px-3 py-2 text-sm font-semibold text-[var(--accent-blue)] disabled:opacity-50"
              >
                {pending ? "Requesting…" : `Scout “${q.trim()}” from EA`}
              </button>
              {status && <p className="mt-2 text-xs text-[var(--muted-fg)]">{status}</p>}
            </div>
          )}
        </section>
      ) : (
        <>
          {children}
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                  sort === s.key
                    ? "border-[var(--accent-blue)] bg-[rgba(92,200,255,0.15)] text-[var(--accent-blue)]"
                    : "border-[var(--card-border)] text-[var(--muted-fg)]",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <section className="arena-card my-3 overflow-hidden">
            <ul className="divide-y divide-white/[0.05]">
              {sorted.map((c) => (
                <li key={c.clubId}>
                  <OpponentRow o={c} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

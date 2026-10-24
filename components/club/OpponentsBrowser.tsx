"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { checkScout, requestScout } from "@/app/opponents/actions";
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
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const router = useRouter();

  // While EA is being searched, check every few seconds; when it's answered, reload the data
  // so the new clubs show up in the results below.
  useEffect(() => {
    if (!waitingFor) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      const row = await checkScout(waitingFor).catch(() => null);
      if (row && row.status !== "pending") {
        clearInterval(timer);
        setWaitingFor(null);
        setStatus(
          row.status === "done"
            ? (row.results ?? 1) > 1
              ? `Found ${row.results} clubs on EA.`
              : "Found on EA."
            : row.status === "not_found"
              ? `EA has no club called “${waitingFor}”.`
              : "EA didn't answer. Try again in a minute.",
        );
        router.refresh();
      } else if (Date.now() - started > 150_000) {
        clearInterval(timer);
        setWaitingFor(null);
        setStatus("Still waiting on EA. Reopen this page in a minute to see the results.");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [waitingFor, router]);

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
      if (r.status === "created" || r.status === "exists") setWaitingFor(q.trim());
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
            setWaitingFor(null);
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
                disabled={pending || !!waitingFor}
                className="w-full rounded-xl bg-[rgba(92,200,255,0.15)] px-3 py-2 text-sm font-semibold text-[var(--accent-blue)] disabled:opacity-50"
              >
                {pending ? "Requesting…" : waitingFor ? "Searching EA…" : `Scout “${q.trim()}” from EA`}
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

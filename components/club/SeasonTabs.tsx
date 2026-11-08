"use client";

import { useState, type ReactNode } from "react";

/** "Season | Playoffs" switch over the main season card. */
export function SeasonTabs({ season, playoffs }: { season: ReactNode; playoffs: ReactNode }) {
  const [tab, setTab] = useState<"season" | "playoffs">("season");
  const tabs = [
    { id: "season", label: "Season" },
    { id: "playoffs", label: "🏆 Playoffs" },
  ] as const;
  return (
    <div className="my-3">
      <div role="tablist" className="mb-1.5 flex gap-1 rounded-xl bg-white/[0.04] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-[rgba(92,200,255,0.15)] text-[var(--accent-blue)]" : "text-[var(--muted-fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="[&>section]:my-0">{tab === "season" ? season : playoffs}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ResultPill } from "@/components/club/ResultPill";
import { seasonProgress } from "@/lib/stats/season";
import { applyWhatIf, cycle, editableSlots, type Pick } from "@/lib/stats/whatif";

const LABEL: Record<string, string> = {
  "not-started": "Season not started",
  "title-zone": "🏆 Division title",
  "promotion-zone": "⬆ Promoted",
  contending: "Still in the race",
  "promotion-in-reach": "Promotion still possible",
  safe: "🛡 Safe",
  "at-risk": "⚠️ At risk",
  relegated: "⬇ Relegated",
};

export function WhatIf({ seasonResults, division }: { seasonResults: string[]; division: number }) {
  const slots = editableSlots(seasonResults);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Pick[]>(() => Array(slots).fill(""));
  if (slots === 0) return null;

  const result = seasonProgress(applyWhatIf(seasonResults, picks), division);
  const outcome = (p: Pick) => (p === "wins" ? "W" : p === "losses" ? "L" : p === "otl" ? "OTL" : null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2.5 text-xs font-semibold text-[var(--accent-blue)]">
        🔮 What if? Plan the rest of the season →
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl bg-white/[0.04] p-2.5">
      <div className="flex items-center justify-between text-[11px] text-[var(--muted-fg)]">
        <span>Tap a game: W → OTL → L</span>
        <button onClick={() => setPicks(Array(slots).fill(""))} className="font-semibold text-[var(--accent-blue)]">
          Reset
        </button>
      </div>
      <div className="mt-2 flex gap-1">
        {picks.map((p, i) => (
          <button
            key={i}
            aria-label={`Remaining game ${i + 1}: ${p || "not played"}`}
            onClick={() => setPicks((all) => all.map((x, j) => (j === i ? cycle(x) : x)))}
            className="min-w-0 flex-1"
          >
            <ResultPill outcome={outcome(p)} className="w-full" />
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm font-bold">
        {LABEL[result.state]} · <span className="tabular">{result.points} pts</span>
      </p>
      {result.outlook && <p className="text-xs text-[var(--accent-blue)]">{result.outlook}</p>}
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Small nudge on Home for people who skipped onboarding. Closing it hides it until the next visit. */
export function SetupCard() {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className="arena-card my-3 flex items-center gap-2 py-2.5 pr-1.5 pl-3.5 text-sm">
      <Link href="/me" className="min-w-0 flex-1">
        <span className="font-semibold">Set up your profile</span>
        <span className="block text-xs text-[var(--muted-fg)]">Pick your gamertag to get your own stats and streaks.</span>
      </Link>
      <button onClick={() => setClosed(true)} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-[var(--muted-fg)] active:bg-white/[0.08]">
        <X className="size-4" />
      </button>
    </div>
  );
}

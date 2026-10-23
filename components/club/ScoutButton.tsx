"use client";

import { useState, useTransition } from "react";
import { requestScout } from "@/app/opponents/actions";

export function ScoutButton({ name }: { name: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="text-xs text-[var(--muted-fg)]">Requested. Live info appears within ~10 minutes.</p>;
  return (
    <button
      onClick={() => start(async () => { await requestScout(name); setDone(true); })}
      disabled={pending}
      className="w-full rounded-xl bg-[rgba(92,200,255,0.15)] px-3 py-2 text-sm font-semibold text-[var(--accent-blue)] disabled:opacity-50"
    >
      {pending ? "Requesting…" : "Scout this club for live info"}
    </button>
  );
}

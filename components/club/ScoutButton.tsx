"use client";

import { useState, useTransition } from "react";
import { requestScout } from "@/app/opponents/actions";
import { scoutMessage } from "@/components/club/scoutMessages";

export function ScoutButton({ name, clubId }: { name: string; clubId: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (message) return <p className="text-xs text-[var(--muted-fg)]">{message}</p>;
  return (
    <button
      onClick={() =>
        start(async () => {
          const r = await requestScout(name, clubId).catch(() => ({ status: "error" as const }));
          setMessage(scoutMessage(r.status));
        })
      }
      disabled={pending}
      className="w-full rounded-xl bg-[rgba(92,200,255,0.15)] px-3 py-2 text-sm font-semibold text-[var(--accent-blue)] disabled:opacity-50"
    >
      {pending ? "Requesting…" : "Scout this club for live info"}
    </button>
  );
}

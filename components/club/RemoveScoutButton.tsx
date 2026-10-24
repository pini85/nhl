"use client";

import { X } from "lucide-react";
import { useTransition } from "react";
import { removeScoutRequest } from "@/app/opponents/actions";

export function RemoveScoutButton({ id, query }: { id: number; query: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => void (await removeScoutRequest(id).catch(() => null)))}
      disabled={pending}
      aria-label={`Remove ${query}`}
      className="-mr-1 shrink-0 rounded-md p-1 text-[var(--muted-fg)] hover:text-[var(--fg)] disabled:opacity-40"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

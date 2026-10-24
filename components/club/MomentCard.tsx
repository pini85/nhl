"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { markSeen } from "@/app/me/actions";
import { Confetti } from "@/components/club/Celebrate";

export type MomentItem = { id: string; text: string; href: string | null; mine: boolean; celebrate: boolean };

/** Cards for moments not seen yet; ✕ or opening one marks it seen for good on this device. */
export function MomentList({ items, limit, title }: { items: MomentItem[]; limit?: number; title?: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const visible = items.filter((m) => !hidden.has(m.id));
  if (!visible.length) return null;
  const shown = limit && !all ? visible.slice(0, limit) : visible;

  const seen = (id: string) => {
    setHidden((h) => new Set(h).add(id));
    void markSeen([id]);
  };

  return (
    <section aria-label={title ?? "New moments"} className="my-3 space-y-2">
      {title && <h2 className="px-1 text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{title}</h2>}
      {shown.map((m) => (
        <div
          key={m.id}
          className={`arena-card flex items-center gap-2 py-2.5 pr-1.5 pl-3.5 text-sm ${m.mine ? "border-[var(--accent-blue)]" : ""}`}
          data-moment={m.id}
        >
          {m.celebrate && <Confetti storageKey={`moment:${m.id}`} />}
          {m.href ? (
            <Link href={m.href} onClick={() => seen(m.id)} className="min-w-0 flex-1 font-semibold">
              {m.text}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 font-semibold">{m.text}</span>
          )}
          <button onClick={() => seen(m.id)} aria-label="Dismiss" className="shrink-0 rounded-full p-1.5 text-[var(--muted-fg)] active:bg-white/[0.08]">
            <X className="size-4" />
          </button>
        </div>
      ))}
      {limit && !all && visible.length > limit && (
        <button onClick={() => setAll(true)} className="w-full py-1.5 text-xs font-semibold text-[var(--accent-blue)]">
          Show all ({visible.length})
        </button>
      )}
    </section>
  );
}

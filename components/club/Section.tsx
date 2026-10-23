import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, right, children, className }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("arena-card my-3 p-3.5", className)}>
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between">
          {title && <h2 className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted-fg)] uppercase">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="arena-card my-6 p-6 text-center">
      <div className="text-3xl">🏒</div>
      <p className="mt-2 font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--muted-fg)]">{hint}</p>}
    </div>
  );
}

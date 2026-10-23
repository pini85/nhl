import { cn } from "@/lib/utils";

export function StatTile({ label, value, glow = false }: { label: string; value: string | number; glow?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2.5 text-center">
      <div className={cn("tabular text-xl font-black", glow && "glow text-[var(--accent-blue)]")}>{value}</div>
      <div className="mt-0.5 text-[10px] tracking-wide text-[var(--muted-fg)] uppercase">{label}</div>
    </div>
  );
}

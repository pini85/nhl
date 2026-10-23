import { cn } from "@/lib/utils";

export function ResultPill({
  outcome,
  overtime = false,
  dnf = "none",
  className,
}: {
  outcome: "W" | "L" | "OTL" | null;
  overtime?: boolean;
  dnf?: string;
  className?: string;
}) {
  const style =
    outcome === "W"
      ? "bg-[var(--win-bg)] text-[var(--win-fg)]"
      : outcome === "L"
        ? "bg-[var(--loss-bg)] text-[var(--loss-fg)]"
        : outcome === "OTL"
          ? "bg-[var(--otl-bg)] text-[var(--otl-fg)]"
          : "bg-white/5 text-[var(--muted-fg)]";
  return (
    <span
      className={cn("inline-flex min-w-7 items-center justify-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold", style, className)}
      title={dnf === "opponent_quit" ? "Opponent quit" : dnf === "we_quit" ? "We quit" : undefined}
    >
      {outcome ?? "·"}
      {overtime && <span className="text-[9px] font-bold opacity-80">OT</span>}
      {dnf !== "none" && <span className="text-[9px] opacity-80">⚑</span>}
    </span>
  );
}

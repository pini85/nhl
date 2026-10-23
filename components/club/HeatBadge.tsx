import type { Heat } from "@/lib/stats/trends";

export function HeatBadge({ heat }: { heat: Heat | undefined }) {
  if (heat === "hot") return <span role="img" aria-label="Hot" title="Hot: last 5 games well above their average">🔥</span>;
  if (heat === "cold") return <span role="img" aria-label="Cold" title="Cold: last 5 games well below their average">🧊</span>;
  return null;
}

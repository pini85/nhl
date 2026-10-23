import type { SeasonState } from "@/lib/stats/season";

// Once per device per season and outcome (the key is stored in localStorage).
export function celebrationFor(state: SeasonState, division: number, seasons: number): { message: string; key: string } | null {
  if (state === "title-zone") return { message: "🏆 Division title!", key: `celebrated:${division}:${seasons}:${state}` };
  if (state === "promotion-zone") return { message: "⬆ Promotion clinched!", key: `celebrated:${division}:${seasons}:${state}` };
  return null;
}

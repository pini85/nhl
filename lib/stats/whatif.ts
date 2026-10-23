import { SEASON_GAMES } from "@/lib/divisions";

export type Pick = "" | "wins" | "otl" | "losses";
const ORDER: Pick[] = ["", "wins", "otl", "losses"];

export const cycle = (p: Pick | string): Pick => ORDER[(ORDER.indexOf(p as Pick) + 1) % ORDER.length];

const played = (r: string[]) => r.filter((x) => x === "wins" || x === "losses" || x === "otl");

export function editableSlots(seasonResults: string[]): number {
  return Math.max(0, SEASON_GAMES - played(seasonResults).length);
}

// Real results plus imagined future games, capped at a 10-game season.
export function applyWhatIf(seasonResults: string[], picks: Pick[]): string[] {
  const real = played(seasonResults);
  const future = picks.filter(Boolean).slice(0, editableSlots(seasonResults));
  const all = [...future.reverse(), ...real]; // newest first, like EA
  return [...all, ...Array(Math.max(0, SEASON_GAMES - all.length)).fill("")];
}

// Arcade progress lives on this device only. Storage can be missing (private mode), so every access is guarded.

export type Progress = {
  avenged: number[];
  wins: number;
  losses: number;
  insane: boolean;
  muted: boolean;
  lineup?: string[];
  goalie?: string;
};

const KEY = "ddd-arcade-v1";
export const EMPTY: Progress = { avenged: [], wins: 0, losses: 0, insane: false, muted: false };

export function parseProgress(raw: string | null): Progress {
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      avenged: Array.isArray(p.avenged) ? p.avenged.filter((n) => Number.isInteger(n)) : [],
      wins: Number.isInteger(p.wins) ? p.wins! : 0,
      losses: Number.isInteger(p.losses) ? p.losses! : 0,
      insane: p.insane === true,
      muted: p.muted === true,
      lineup: Array.isArray(p.lineup) ? p.lineup.filter((s) => typeof s === "string").slice(0, 3) : undefined,
      goalie: typeof p.goalie === "string" ? p.goalie : undefined,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    return { ...EMPTY };
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

/** After a game: the record, and the club is avenged when a tour game is won. */
export function recordResult(p: Progress, clubId: number, won: boolean, tour: boolean): Progress {
  return {
    ...p,
    wins: p.wins + (won ? 1 : 0),
    losses: p.losses + (won ? 0 : 1),
    avenged: won && tour && !p.avenged.includes(clubId) ? [...p.avenged, clubId] : p.avenged,
  };
}

export function nextStop(tour: number[], avenged: number[]): number | null {
  return tour.find((id) => !avenged.includes(id)) ?? null;
}

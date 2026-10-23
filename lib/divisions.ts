// EASHL season rules: 10 games, W = 2, OTL = 1, L = 0, max 20 points.
// Thresholds per division (from chelhead's public client code; not published by EA).
export const SEASON_GAMES = 10;
export const MAX_POINTS = 20;

export type Division = {
  id: number;
  hold: number;
  promotion: number;
  title: number;
  conference: "Gold" | "Silver" | "Bronze";
};

const TABLE: Array<[number, number, number, number, Division["conference"]]> = [
  [1, 9, 16, 16, "Gold"],
  [2, 8, 13, 15, "Gold"],
  [3, 8, 12, 14, "Silver"],
  [4, 7, 11, 13, "Silver"],
  [5, 7, 11, 13, "Silver"],
  [6, 7, 10, 12, "Silver"],
  [7, 6, 9, 11, "Bronze"],
  [8, 5, 8, 10, "Bronze"],
  [9, 4, 7, 9, "Bronze"],
  [10, 0, 6, 8, "Bronze"],
];

const BY_ID = new Map<number, Division>(
  TABLE.map(([id, hold, promotion, title, conference]) => [id, { id, hold, promotion, title, conference }]),
);

export function getDivision(id: number): Division | null {
  return BY_ID.get(id) ?? null;
}

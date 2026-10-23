import type { SkaterTotals } from "@/lib/stats/players";

export type CompareRow = { label: string; a: number; b: number; better: "a" | "b" | "tie" };

const ROWS: { label: string; get: (s: SkaterTotals) => number; lowerIsBetter?: boolean; digits?: number }[] = [
  { label: "Games", get: (s) => s.gp },
  { label: "Goals", get: (s) => s.goals },
  { label: "Assists", get: (s) => s.assists },
  { label: "Points", get: (s) => s.points },
  { label: "Points / game", get: (s) => s.pointsPerGame, digits: 2 },
  { label: "+/-", get: (s) => s.plusMinus },
  { label: "Shots", get: (s) => s.shots },
  { label: "Shooting %", get: (s) => s.shotPct, digits: 1 },
  { label: "Hits", get: (s) => s.hits },
  { label: "Takeaways", get: (s) => s.takeaways },
  { label: "Giveaways", get: (s) => s.giveaways, lowerIsBetter: true },
  { label: "PIM", get: (s) => s.pim, lowerIsBetter: true },
];

export function compareRows(a: SkaterTotals, b: SkaterTotals): CompareRow[] {
  return ROWS.map((r) => {
    const round = (n: number) => (r.digits ? Number(n.toFixed(r.digits)) : n);
    const [va, vb] = [round(r.get(a)), round(r.get(b))];
    const aBetter = r.lowerIsBetter ? va < vb : va > vb;
    return { label: r.label, a: va, b: vb, better: va === vb ? "tie" : aBetter ? "a" : "b" };
  });
}

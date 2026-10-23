// Stats where a smaller number is better.
const LOWER_IS_BETTER = new Set(["gaa", "goalsAgainst", "giveaways", "pim"]);

export function sortLeaders<T>(rows: T[], key: string): T[] {
  const dir = LOWER_IS_BETTER.has(key) ? 1 : -1;
  const val = (r: T) => Number((r as Record<string, unknown>)[key] ?? 0);
  return [...rows].sort((a, b) => dir * (val(a) - val(b)));
}

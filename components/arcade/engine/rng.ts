/** Small seeded random generator (mulberry32), so games and tests can be replayed. */
export function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    /** Roughly normal, mean 0, sd ~1. */
    gauss: () => (next() + next() + next() + next() - 2) * 1.73,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof makeRng>;

import { describe, expect, it } from "vitest";
import { arcSlots, forceLayout, gamePositions, rng, SPIRAL } from "@/components/galaxy/layout";

const H = 3600_000;

describe("rng", () => {
  it("repeats for the same seed and stays in [0, 1)", () => {
    const a = rng(9);
    const b = rng(9);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("gamePositions", () => {
  const games = Array.from({ length: 30 }, (_, i) => ({ t: i * 0.5 * H + Math.floor(i / 5) * 48 * H, gf: i % 5, ga: 2 }));
  const { xyz, size } = gamePositions(games);
  const radius = (i: number) => Math.hypot(xyz[i * 3], xyz[i * 3 + 2]);

  it("puts the newest game by the core and the oldest at the rim", () => {
    expect(radius(29)).toBeLessThan(SPIRAL.rMin + 0.5);
    expect(radius(0)).toBeGreaterThan(SPIRAL.rMax - 0.5);
  });

  it("raises wins and lowers losses", () => {
    expect(xyz[4 * 3 + 1]).toBeGreaterThan(0.1); // 4-2
    expect(xyz[0 * 3 + 1]).toBeLessThan(-0.1); // 0-2
  });

  it("is deterministic and gives a sane star size", () => {
    expect(gamePositions(games).xyz).toEqual(xyz);
    expect(size).toBeGreaterThanOrEqual(0.2);
    expect(size).toBeLessThanOrEqual(0.62);
  });

  it("handles 0 and 1 games", () => {
    expect(gamePositions([]).xyz).toHaveLength(0);
    expect(gamePositions([{ t: 0, gf: 1, ga: 0 }]).xyz).toHaveLength(3);
  });
});

describe("forceLayout", () => {
  const links = [
    { a: 0, b: 1, w: 1 },
    { a: 1, b: 2, w: 0.2 },
    { a: 3, b: 4, w: 1 },
  ];
  const pos = forceLayout(6, links, { radius: 4 });
  const dist = (i: number, j: number) => Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);

  it("fits inside the radius with finite numbers", () => {
    for (let i = 0; i < 6; i++) {
      expect(Number.isFinite(pos[i * 3])).toBe(true);
      expect(Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])).toBeLessThanOrEqual(4.0001);
    }
  });

  it("keeps strong partners closer than strangers", () => {
    expect(dist(0, 1)).toBeLessThan(dist(0, 5));
  });

  it("is deterministic", () => expect(forceLayout(6, links, { radius: 4 })).toEqual(pos));
});

describe("arcSlots", () => {
  it("puts the leader in the middle, then alternates sides", () => {
    const s = arcSlots(5);
    expect(s[0].x).toBeCloseTo(0, 5);
    expect(Math.sign(s[1].x)).toBe(-Math.sign(s[2].x));
    expect(Math.abs(s[3].x)).toBeGreaterThan(Math.abs(s[1].x));
  });

  it("handles 0 and 1 bars", () => {
    expect(arcSlots(0)).toEqual([]);
    expect(arcSlots(1)[0].x).toBeCloseTo(0, 5);
  });
});

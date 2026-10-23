import { describe, expect, it } from "vitest";
import { chemistry, withWithout } from "@/lib/stats/chemistry";
import { games, lines } from "../helpers/club-fixtures";

describe("chemistry", () => {
  const { trios, pairs } = chemistry(lines, games, 56507);
  it("finds the main trio", () => {
    expect(trios[0]).toMatchObject({ names: ["Kai_Fretwell18", "puck_control", "ThePooker"], gp: 6, wins: 4, losses: 2 });
    expect(trios[0].winPct).toBeCloseTo(4 / 6, 5);
  });
  it("requires 3 games together", () => expect(trios).toHaveLength(1));
  it("finds the main D-pair", () => expect(pairs).toEqual([expect.objectContaining({ names: ["mike_v_75", "PePezki_"], gp: 6, wins: 4 })]));
  it("skips games without a full forward line", () => {
    const noCenter = lines.filter((l) => !(l.matchId === "2782817800237" && l.position === "center"));
    expect(chemistry(noCenter, games, 56507).trios[0].gp).toBe(5);
  });
  it("lower threshold shows more combos", () => expect(chemistry(lines, games, 56507, 1).trios).toHaveLength(3));
});

describe("withWithout", () => {
  const ww = withWithout(lines, games, 56507);
  it("everyone-game players have no 'without' side", () => {
    expect(ww.find((x) => x.name === "ThePooker")).toMatchObject({ withGp: 9, withoutPct: null, withoutGp: 0 });
  });
  it("computes both sides", () => {
    const kai = ww.find((x) => x.name === "Kai_Fretwell18")!;
    expect(kai.withGp + kai.withoutGp).toBe(9);
    expect(kai.withoutPct).not.toBeNull();
  });
});

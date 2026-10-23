import { describe, expect, it } from "vitest";
import { compareRows } from "@/lib/stats/compare";
import { playerTotals } from "@/lib/stats/players";
import { games, lines } from "../helpers/club-fixtures";

const { skaters } = playerTotals(lines, games, null, 56507);
const pooker = skaters.find((s) => s.name === "ThePooker")!;
const puck = skaters.find((s) => s.name === "puck_control")!;

describe("compareRows", () => {
  const rows = compareRows(pooker, puck);
  it("marks the better side per stat", () => {
    expect(rows.find((r) => r.label === "Goals")).toEqual({ label: "Goals", a: 11, b: 9, better: "a" });
    expect(rows.find((r) => r.label === "Assists")).toMatchObject({ a: 10, b: 11, better: "b" });
    expect(rows.find((r) => r.label === "+/-")).toMatchObject({ better: "tie" });
  });
  it("lower is better for giveaways", () => {
    const r = rows.find((x) => x.label === "Giveaways")!;
    expect(r.better).toBe(r.a < r.b ? "a" : r.a > r.b ? "b" : "tie");
  });
});

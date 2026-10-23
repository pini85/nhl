import { describe, expect, it } from "vitest";
import { seasonProgress } from "@/lib/stats/season";
import { applyWhatIf, cycle, editableSlots } from "@/lib/stats/whatif";

const current = ["losses", "wins", "wins", "wins", "", "", "", "", "", ""];

describe("what-if", () => {
  it("cycles blank → W → OTL → L → blank", () => {
    expect(["", "wins", "otl", "losses"].map(cycle)).toEqual(["wins", "otl", "losses", ""]);
  });
  it("counts remaining slots", () => {
    expect(editableSlots(current)).toBe(6);
    expect(editableSlots(Array(10).fill("wins"))).toBe(0);
  });
  it("one more win gets Div 8 promoted", () => {
    const next = applyWhatIf(current, ["wins"]);
    expect(seasonProgress(next, 8).state).toBe("promotion-zone");
  });
  it("ignores picks beyond the season and blanks", () => {
    const next = applyWhatIf(current, ["wins", "", "wins", "wins", "wins", "wins", "wins", "wins"]);
    expect(next.filter(Boolean)).toHaveLength(10);
  });
  it("a complete season cannot be changed", () => {
    expect(applyWhatIf(Array(10).fill("losses"), ["wins"])).toEqual(Array(10).fill("losses"));
  });
});

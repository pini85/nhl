import { describe, expect, it } from "vitest";
import { countRecord, formatRecord } from "@/lib/stats/record";

const g = (outcome: "W" | "L", overtime = false) => ({ outcome, overtime });

describe("record", () => {
  it("splits overtime losses from regulation losses", () => {
    expect(countRecord([g("W"), g("L"), g("L", true), g("L", true), g("W", true)])).toEqual({ wins: 2, losses: 1, otLosses: 2 });
  });
  it("shows W-L-OTL only when there were OT losses", () => {
    expect(formatRecord({ wins: 1, losses: 1, otLosses: 2 })).toBe("1-1-2");
    expect(formatRecord({ wins: 3, losses: 2, otLosses: 0 })).toBe("3-2");
    expect(formatRecord({ wins: 2, losses: 2, otLosses: 2 }, "–")).toBe("2–2–2");
  });
});

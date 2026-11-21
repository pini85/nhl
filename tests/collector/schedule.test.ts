import { describe, expect, it } from "vitest";
import { isPlayHours, msUntilNextRun } from "@/lib/collector/schedule";

const MIN = 60_000;
// November: Amsterdam is UTC+1.
const at = (utc: string) => new Date(`2026-11-20T${utc}Z`);

describe("collector schedule", () => {
  it("runs every ~10 minutes in the evening", () => {
    expect(msUntilNextRun(at("19:12:00"))).toBe(8 * MIN); // 20:12 Amsterdam
    expect(msUntilNextRun(at("00:30:00"))).toBe(8 * MIN); // 01:30
  });

  it("runs just after the hour the rest of the day", () => {
    expect(msUntilNextRun(at("09:10:00"))).toBe(55 * MIN); // 10:10 → 11:05
    expect(msUntilNextRun(at("06:58:00"))).toBe(7 * MIN); // 07:58 → 08:05, in time for the recap
    expect(msUntilNextRun(at("10:04:30"))).toBe(60 * MIN + 30_000); // 11:04:30 → 12:05
  });

  it("knows the play hours", () => {
    expect([17, 18, 23, 0, 2, 3].map(isPlayHours)).toEqual([false, true, true, true, true, false]);
  });
});

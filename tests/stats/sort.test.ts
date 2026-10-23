import { describe, expect, it } from "vitest";
import { sortLeaders } from "@/lib/stats/sort";

describe("sortLeaders", () => {
  const rows = [
    { name: "a", gaa: 3.5, savePct: 0.8 },
    { name: "b", gaa: 1.2, savePct: 0.9 },
  ];
  it("sorts GAA ascending (lower is better)", () => expect(sortLeaders(rows, "gaa").map((r) => r.name)).toEqual(["b", "a"]));
  it("sorts other stats descending", () => expect(sortLeaders(rows, "savePct").map((r) => r.name)).toEqual(["b", "a"]));
  it("does not mutate the input", () => {
    sortLeaders(rows, "gaa");
    expect(rows[0].name).toBe("a");
  });
});

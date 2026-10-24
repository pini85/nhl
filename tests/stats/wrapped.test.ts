import { describe, expect, it } from "vitest";
import { buildWrapped } from "@/lib/stats/wrapped";
import { games, lines, normalized } from "../helpers/club-fixtures";

const clubs = normalized.flatMap((n) => n.clubs);

describe("buildWrapped", () => {
  const w = buildWrapped(games, lines, clubs, 56507);
  const slide = (k: string) => w.slides.find((s) => s.kind === k)!;
  it("opens with games and record", () => expect(slide("games")).toMatchObject({ big: "10", line: "7 wins · 3 losses" }));
  it("goals", () => expect(slide("goals")).toMatchObject({ big: "37" }));
  it("top scorer", () => expect(slide("scorer")).toMatchObject({ big: "21", title: "ThePooker" }));
  it("hit machine", () => expect(slide("hits")).toMatchObject({ big: "47", title: "PePezki_" }));
  it("best night", () => expect(slide("night").title).toBe("Thu Oct 22"));
  it("nemesis is our worst loss", () => expect(slide("nemesis")).toMatchObject({ big: "0-1", title: "Hockeyholics" }));
  it("falls back to most played when we never lost", () => {
    const w2 = buildWrapped(games.filter((g) => g.outcome === "W"), lines, clubs, 56507);
    expect(w2.slides.some((s) => s.kind === "nemesis")).toBe(false);
    expect(w2.slides.find((s) => s.kind === "most-played")).toBeTruthy();
  });
  it("best passer among skaters with 100+ pass attempts", () => {
    expect(slide("passer").title).toBeTruthy();
    expect(slide("passer").big).toMatch(/^\d+%$/);
  });
  it("takeaway king", () => expect(slide("thief").title).toBeTruthy());
  it("labels each big number with its unit", () => {
    expect(slide("scorer").unit).toBe("points");
    expect(slide("hits").unit).toBe("hits");
    expect(slide("thief").unit).toBe("takeaways");
    expect(slide("passer").unit).toBe("pass completion");
    expect(slide("night").unit).toBe("wins – losses");
    expect(slide("nemesis").unit).toBe("wins – losses vs them");
    expect(w.slides.filter((s) => s.kind !== "outro").every((s) => s.unit)).toBe(true);
  });
  it("ends with the outro", () => expect(w.slides.at(-1)?.kind).toBe("outro"));
  it("empty without games", () => expect(buildWrapped([], [], [], 56507).slides).toEqual([]));
});

describe("buildWrapped with extra stats", () => {
  it("top scorer counts games without a box score", () => {
    const extra = {
      eaPlayerId: "1273735466", playerName: "puck_control", coversFrom: new Date("2026-10-15T19:42:49Z"),
      gp: 11, goals: 14, assists: 13, plusMinus: 4, shots: 33, hits: 0, pim: 8, ppg: 2, shg: 1, takeaways: 25, giveaways: 73,
      blockedShots: 1, interceptions: 3, passAttempts: 0, passes: 0,
    };
    const w = buildWrapped(games, lines, clubs, 56507, [extra]);
    expect(w.slides.find((s) => s.kind === "scorer")).toMatchObject({ big: "47", title: "puck_control" });
  });
});

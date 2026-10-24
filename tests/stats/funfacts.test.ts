import { describe, expect, it } from "vitest";
import { funFacts } from "@/lib/stats/funfacts";
import { games, lines } from "../helpers/club-fixtures";

describe("funFacts", () => {
  const facts = funFacts(lines, games, 56507);
  const text = facts.map((f) => f.text);
  it("record when a player scores", () => expect(text).toContain("Team record when ThePooker gets a point: 5-1"));
  it("best shooter (10+ shots)", () => expect(text).toContain("Kai_Fretwell18 scores on 36% of shots"));
  it("hit machine", () => expect(text).toContain("PePezki_ has thrown 47 hits"));
  it("best passer (100+ attempts)", () => expect(text.some((t) => /completes \d+% of passes/.test(t))).toBe(true));
  it("top guest", () => expect(text).toContain("Guest of honor: Kai_Fretwell18 with 15 points"));
  it("blowouts", () => expect(text).toContain("2 wins by 4 goals or more"));
  it("sorted by interest, each fact unique", () => {
    expect(new Set(text).size).toBe(text.length);
    for (let i = 1; i < facts.length; i++) expect(facts[i - 1].score).toBeGreaterThanOrEqual(facts[i].score);
  });
  it("never uses a player with fewer than 3 games", () => {
    const base = lines.find((l) => l.eaPlayerId === "828785353")!;
    const rookie = ["2782817800237", "2780666310166"].map((matchId) => ({
      ...base, matchId, eaPlayerId: "rookie", playerName: "Rookie", goals: 4, assists: 0, shots: 6, hits: 30,
    }));
    const t = funFacts([...lines, ...rookie], games, 56507).map((f) => f.text).join(" | ");
    expect(t).not.toContain("Rookie");
  });

  it("nothing on a tiny dataset", () => {
    const two = games.slice(0, 2);
    const ids = new Set(two.map((g) => g.matchId));
    expect(funFacts(lines.filter((l) => ids.has(l.matchId)), two, 56507)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { groupGameNights, nightMvp, threeStars } from "@/lib/stats/nights";
import type { GameLite } from "@/lib/stats/types";
import { games, lines, linesOf } from "../helpers/club-fixtures";

const g = (matchId: string, iso: string): GameLite => ({
  matchId,
  playedAt: new Date(iso),
  opponentClubId: 1,
  opponentName: "X",
  goalsFor: 1,
  goalsAgainst: 0,
  outcome: "W",
  overtime: false,
  dnf: "none",
  source: "full",
  matchType: "gameType5",
});

describe("groupGameNights", () => {
  it("groups the 10 games into 3 nights", () => {
    const n = groupGameNights(games);
    expect(n.map((x) => [x.label, x.wins, x.losses, x.games.length])).toEqual([
      ["Thu Oct 22", 5, 2, 7],
      ["Tue Oct 20", 2, 0, 2],
      ["Sun Oct 18", 0, 1, 1],
    ]);
    expect(n[0].key).toBe("2026-10-22");
    expect(n[0].games[0].matchId).toBe("2782817800237");
    expect(n[0]).toMatchObject({ goalsFor: 29, goalsAgainst: 20 });
  });

  it("keeps a session across midnight (DST night) as one night", () => {
    const n = groupGameNights([g("a", "2026-10-24T21:30:00Z"), g("b", "2026-10-24T22:20:00Z")]);
    expect(n).toHaveLength(1);
    expect(n[0].label).toBe("Sat Oct 24");
  });

  it("splits on a 3h+ gap", () => {
    expect(groupGameNights([g("a", "2026-10-20T18:00:00Z"), g("b", "2026-10-20T21:30:00Z")])).toHaveLength(2);
  });

  it("handles no games", () => expect(groupGameNights([])).toEqual([]));
});

describe("threeStars", () => {
  it("three stars of the INFERNAL LEGION loss (our club)", () => {
    expect(threeStars(linesOf("2782817800237"), 56507).map((p) => p.playerName)).toEqual([
      "ThePooker",
      "Kai_Fretwell18",
      "PePezki_",
    ]);
  });
});

describe("nightMvp", () => {
  it("night MVP for Thu Oct 22", () => {
    const night = groupGameNights(games)[0];
    const ids = new Set(night.games.map((x) => x.matchId));
    expect(nightMvp(lines.filter((l) => ids.has(l.matchId)), 56507)).toEqual({
      eaPlayerId: "1273735466",
      playerName: "puck_control",
      goals: 8,
      assists: 10,
      points: 18,
    });
  });

  it("returns null with no lines", () => expect(nightMvp([], 56507)).toBeNull());
});

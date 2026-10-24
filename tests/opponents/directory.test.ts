import { describe, expect, it } from "vitest";
import { opponentDirectory } from "@/lib/opponents/directory";
import { headToHead } from "@/lib/stats/opponents";
import type { GameLite } from "@/lib/stats/types";

describe("opponentDirectory", () => {
  it("leaves out our own club even if someone scouted it", () => {
    const rows = opponentDirectory([], [{ clubId: 56507, name: "Drop drop drop", crestAssetId: null }, { clubId: 1, name: "Hello Buddy", crestAssetId: null }], new Map());
    expect(rows.map((r) => r.clubId)).toEqual([1]);
  });

  it("carries the last game against each club", () => {
    const g = (gf: number, ga: number, iso: string): GameLite => ({
      matchId: iso, playedAt: new Date(iso), opponentClubId: 3592, opponentName: "CSKA MOSCOW HK", goalsFor: gf, goalsAgainst: ga,
      outcome: gf > ga ? "W" : "L", overtime: false, dnf: "opponent_quit", source: "full", matchType: "gameType5",
    });
    const [row] = opponentDirectory(headToHead([g(5, 1, "2026-10-15T21:07:44Z"), g(7, 1, "2026-10-22T21:13:37Z")]), [], new Map());
    expect(row).toMatchObject({ wins: 2, losses: 0, last: { outcome: "W", goalsFor: 7, goalsAgainst: 1, overtime: false, dnf: "opponent_quit" } });
    expect(opponentDirectory([], [{ clubId: 1, name: "Hello Buddy", crestAssetId: null }], new Map())[0].last).toBeNull();
  });
});

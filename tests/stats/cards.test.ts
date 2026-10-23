import { describe, expect, it } from "vitest";
import { playerCard } from "@/lib/stats/cards";
import { games, lines } from "../helpers/club-fixtures";

describe("playerCard", () => {
  it("ThePooker's skater card from EA ratings", () => {
    expect(playerCard(lines, games, "828785353")).toEqual({
      kind: "skater",
      ovr: 78,
      off: 85,
      def: 84,
      team: 66,
      sho: 85,
      phy: 15,
      ply: 56,
      tier: "silver",
      gp: 9,
    });
  });
  it("needs 3 games", () => expect(playerCard(lines, games, "932297358")).toBeNull()); // pushckin, 2 games
  it("goalie card", () => {
    const id = lines.find((l) => l.playerName === "Liengutten")!.eaPlayerId;
    expect(playerCard(lines, games, id)).toMatchObject({ kind: "goalie", ovr: 79, gp: 4, tier: "silver" });
  });
  it("unknown player", () => expect(playerCard(lines, games, "nope")).toBeNull());
});

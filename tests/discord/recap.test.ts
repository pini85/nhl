import { describe, expect, it } from "vitest";
import { escapeMd, nightToPost, recapFacts, recapMessage } from "@/lib/discord/recap";
import { groupGameNights } from "@/lib/stats/nights";
import { game } from "../helpers/builders";
import { games, lines } from "../helpers/club-fixtures";

// Thu Oct 22 is the newest night in the fixtures.
const last = groupGameNights(games)[0];
const lastAt = last.games[0].playedAt;
const input = { games, lines, clubs: [], extras: [], history: [], ourClubId: 56507 };

describe("nightToPost", () => {
  const morning = new Date("2026-10-23T08:30:00Z"); // 10:30 in Amsterdam

  it("posts the newest night the morning after", () => {
    expect(nightToPost(games, morning, new Set())?.key).toBe("2026-10-22");
  });

  it("waits for the morning, and posts each night once", () => {
    expect(nightToPost(games, new Date("2026-10-23T05:59:00Z"), new Set())).toBeNull(); // 07:59 local
    expect(nightToPost(games, new Date("2026-10-23T06:00:00Z"), new Set())?.key).toBe("2026-10-22"); // 08:00 local
    expect(nightToPost(games, morning, new Set(["2026-10-22"]))).toBeNull();
  });

  it("not while the night may still be going, and not for old nights", () => {
    expect(nightToPost(games, new Date(lastAt.getTime() + 3_600_000), new Set(), 0)).toBeNull();
    expect(nightToPost(games, new Date(lastAt.getTime() + 40 * 3_600_000), new Set())).toBeNull();
  });

  it("an afternoon session is posted the next morning, not the same evening", () => {
    const g = [game("a", "2026-10-24T12:00:00Z"), game("b", "2026-10-24T12:30:00Z")];
    expect(nightToPost(g, new Date("2026-10-24T19:00:00Z"), new Set())).toBeNull();
    expect(nightToPost(g, new Date("2026-10-25T08:00:00Z"), new Set())?.key).toBe("2026-10-24");
  });
});

describe("recapMessage", () => {
  const facts = recapFacts(last, input, "https://drop-drop-drop.vercel.app/")!;

  it("has the record, games, MVP and the night's link", () => {
    const text = recapMessage(facts);
    expect(text).toContain(`**${last.wins}-${last.losses}**`);
    expect(text).toContain("**🏆 Night MVP**\npuck\\_control · ");
    expect(text).toContain("https://drop-drop-drop.vercel.app/nights/2026-10-22");
    expect(text.split("\n").filter((l) => /^(✅|❌)/.test(l))).toHaveLength(last.games.length);
    expect(text.length).toBeLessThanOrEqual(2000);
  });

  it("puts the written intro under the score", () => {
    const text = recapMessage(facts, "What a night.");
    expect(text.indexOf("What a night.")).toBeGreaterThan(text.indexOf("GF"));
  });

  it("stays within Discord's limit with lots of extras", () => {
    const many = Array.from({ length: 80 }, (_, i) => `Something notable number ${i} happened tonight`);
    const awards = many.map((text) => ({ text, name: "puck_control", vs: "Opp" }));
    const text = recapMessage({ ...facts, awards, insights: many, highlights: many }, "x".repeat(400));
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text).toContain("/nights/2026-10-22");
  });
});

describe("players in the recap", () => {
  const facts = recapFacts(last, input, "https://site.test")!;

  it("each star and leader gets their own row", () => {
    const rows = recapMessage(facts).split("\n");
    expect(rows.filter((r) => /^⭐+ /.test(r))).toHaveLength(3);
    for (const label of ["💥 Hits:", "🎯 Shots:", "➕ Plus/minus:", "🧤 Save %:"]) expect(rows.some((r) => r.startsWith(label))).toBe(true);
  });

  it("underscores in gamertags don't turn into italics", () => {
    expect(escapeMd("puck_control *x*")).toBe("puck\\_control \\*x\\*");
  });
});

describe("club finals in the recap", () => {
  const finalsGames = [
    game("old", "2026-10-15T20:00:00Z", { matchType: "gameType10", outcome: "W", goalsFor: 3, goalsAgainst: 1 }),
    game("s1", "2026-10-29T20:00:00Z"),
    game("f1", "2026-10-29T20:30:00Z", { matchType: "gameType10", outcome: "W", goalsFor: 4, goalsAgainst: 2 }),
    game("f2", "2026-10-29T21:00:00Z", { matchType: "gameType10", outcome: "W", goalsFor: 2, goalsAgainst: 1 }),
  ];
  const night = groupGameNights(finalsGames)[0];
  const finalsInput = { ...input, games: finalsGames, lines: [] };

  it("adds a club finals section with tonight's record, a cup won and all-time totals", () => {
    const totals = { before: { appearances: 3, cups: 0 }, after: { appearances: 4, cups: 1 } };
    const f = recapFacts(night, finalsInput, "https://site.test", totals)!;
    expect(f.finals).toEqual([
      "🏆 Club finals cup won! Champions!",
      "Tonight: 2-0 · reached round 2",
      "All-time playoff record: 3-0",
      "Club finals: 4 appearances · 1 cup won",
    ]);
    const text = recapMessage(f);
    expect(text).toContain("**🏆 Playoffs · club finals**");
    expect(text).toContain("(playoffs)");
  });

  it("no section on a regular night", () => {
    const regular = groupGameNights([game("a", "2026-10-29T20:00:00Z")])[0];
    const f = recapFacts(regular, { ...input, games: [game("a", "2026-10-29T20:00:00Z")], lines: [] }, "https://site.test")!;
    expect(f.finals).toEqual([]);
    expect(recapMessage(f)).not.toContain("Playoffs");
  });
});

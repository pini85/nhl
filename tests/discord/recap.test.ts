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
    const rows = recapMessage(facts, null, {}).split("\n");
    expect(rows.filter((r) => /^⭐+ /.test(r))).toHaveLength(3);
    for (const label of ["💥 Hits:", "🎯 Shots:", "➕ Plus/minus:", "🧤 Save %:"]) expect(rows.some((r) => r.startsWith(label))).toBe(true);
  });

  it("known players show as their Discord handle, others by gamertag", () => {
    const text = recapMessage(facts, null, { PUCK_CONTROL: "111" });
    expect(text).toContain("**🏆 Night MVP**\n<@111> · ");
    expect(text).not.toContain("puck\\_control ·");
    expect(text).toContain("ThePooker");
  });

  it("underscores in gamertags don't turn into italics", () => {
    expect(escapeMd("puck_control *x*")).toBe("puck\\_control \\*x\\*");
  });
});

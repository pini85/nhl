import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEaApi } from "@/lib/ea/api";

const FIX = "tests/fixtures/ea/2026-10-23";
const read = (f: string) => readFileSync(`${FIX}/${f}`, "utf8");

function apiServing(body: string, status = 200) {
  const fetchImpl = (async () => new Response(body, { status })) as unknown as typeof fetch;
  return createEaApi({ fetchImpl });
}

describe("createEaApi", () => {
  it("parses our 5 fixture matches", async () => {
    const r = await apiServing(read("matches-gameType5.json")).clubMatches(56507, "gameType5");
    expect(r.ok && r.data.map((m) => m.matchId)).toEqual([
      "2782817800237",
      "2780666310166",
      "2782420310153",
      "2782206770466",
      "2782122360291",
    ]);
  });

  it("keeps the valid matches when one is malformed", async () => {
    const list = JSON.parse(read("matches-gameType5.json"));
    const pid = Object.keys(list[4].players["56507"])[0];
    delete list[4].players["56507"][pid].position;
    const r = await apiServing(JSON.stringify(list)).clubMatches(56507, "gameType5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(4);
      expect(r.warnings).toEqual(["invalid-match:2782122360291"]);
    }
  });

  it("treats [] as no games", async () => {
    expect(await apiServing("[]").clubMatches(56507, "gameType10")).toEqual({ ok: true, data: [] });
  });

  it("rejects {} for matches as invalid", async () => {
    const r = await apiServing("{}").clubMatches(56507, "gameType5");
    expect(!r.ok && r.error.kind).toBe("invalid");
  });

  it("parses seasonalStats array and returns the first entry", async () => {
    const r = await apiServing(read("seasonal-stats.json")).seasonalStats(56507);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.currentDivision).toBe(8);
      expect(r.data.recentOpponent6).toBe("1974");
      expect(r.data.recentResults[0]).toBe("losses");
    }
  });

  it("rejects an empty seasonalStats array as invalid", async () => {
    const r = await apiServing("[]").seasonalStats(56507);
    expect(!r.ok && r.error.kind).toBe("invalid");
  });

  it("parses the roster", async () => {
    const r = await apiServing(read("members-stats.json")).members(56507);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(4);
      expect(r.data.find((m) => m.name === "puck_control")).toMatchObject({ goals: 114, position: "leftWing" });
    }
  });

  it("passes http errors through", async () => {
    const r = await apiServing("nope", 404).clubMatches(56507, "gameType5");
    expect(!r.ok && r.error).toMatchObject({ kind: "http", status: 404 });
  });
});

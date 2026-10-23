import { describe, expect, it } from "vitest";
import { getDivision } from "@/lib/divisions";
import { seasonProgress } from "@/lib/stats/season";

const pad = (r: string[]) => [...r, ...Array(10 - r.length).fill("")];

describe("getDivision", () => {
  it("returns Division 8 thresholds", () => {
    expect(getDivision(8)).toEqual({ id: 8, hold: 5, promotion: 8, title: 10, conference: "Bronze" });
  });
  it("division 1 has promotion equal to title", () => {
    expect(getDivision(1)).toMatchObject({ hold: 9, promotion: 16, title: 16, conference: "Gold" });
  });
  it("unknown division is null", () => expect(getDivision(42)).toBeNull());
});

describe("seasonProgress", () => {
  it("our current season: Div 8, L W W W", () => {
    const s = seasonProgress(pad(["losses", "wins", "wins", "wins"]), 8);
    expect(s).toMatchObject({
      points: 6,
      gp: 4,
      remaining: 6,
      wins: 3,
      losses: 1,
      otl: 0,
      state: "contending",
      safeReached: true,
      winsToPromotion: 1,
      winsToTitle: 2,
      maxPoints: 18,
    });
    expect(s.outlook).toBe("1 win to promotion · 2 wins to title");
  });

  it("not started", () => {
    const s = seasonProgress(pad([]), 8);
    expect(s.state).toBe("not-started");
    expect(s.outlook).toBe("10 games, 20 points on the table");
  });

  it("otl counts 1 point", () => expect(seasonProgress(pad(["otl", "wins"]), 8).points).toBe(3));

  it("relegated when the max can't reach the safe line", () => {
    const s = seasonProgress(pad(Array(8).fill("losses")), 7);
    expect(s.state).toBe("relegated");
    expect(s.outlook).toBe("Relegated · can't reach 6 pts");
  });

  it("division 1 has no separate promotion", () => {
    expect(seasonProgress(pad(["wins"]), 1).winsToPromotion).toBeNull();
  });

  it("title zone", () => {
    const s = seasonProgress(pad(Array(5).fill("wins")), 8);
    expect(s.state).toBe("title-zone");
    expect(s.outlook).toBe("Division title secured 🏆");
  });

  it("promotion zone with title still reachable", () => {
    const s = seasonProgress(pad(["wins", "wins", "wins", "wins", "losses"]), 7); // 8 pts, promo 9? no: Div 7 promo 9
    expect(s.state).toBe("contending");
    const p = seasonProgress(pad(["wins", "wins", "wins", "wins", "losses"]), 8); // 8 pts = promo 8
    expect(p.state).toBe("promotion-zone");
    expect(p.outlook).toBe("Promotion secured · 1 win to title");
  });

  it("at risk", () => {
    const s = seasonProgress(pad(["losses", "losses", "losses", "losses", "losses", "losses", "wins"]), 8);
    // 2 pts, 3 left → max 8: title (10) out, promotion (8) reachable → promotion-in-reach
    expect(s.state).toBe("promotion-in-reach");
    expect(s.outlook).toBe("3 wins to promotion");
  });

  it("safe but nothing more reachable", () => {
    const s = seasonProgress(pad(["wins", "wins", "wins", "losses", "losses", "losses", "losses", "losses"]), 8);
    // 6 pts, 2 left → max 10 ≥ title → contending; use Div 6 (hold 7, promo 10, title 12): max 10 → promotion-in-reach
    expect(s.state).toBe("contending");
    const t = seasonProgress(pad(["wins", "wins", "wins", "wins", "losses", "losses", "losses", "losses", "losses"]), 6);
    // 8 pts, 1 left → max 10 = promo 10 → promotion-in-reach
    expect(t.state).toBe("promotion-in-reach");
    const u = seasonProgress(pad(["wins", "wins", "wins", "wins", "losses", "losses", "losses", "losses", "losses", "losses"]), 6);
    // 8 pts, 0 left → max 8: safe (≥7)
    expect(u.state).toBe("safe");
    expect(u.outlook).toBe("Safe from relegation · promotion out of reach");
  });

  it("at risk of relegation", () => {
    const s = seasonProgress(pad(["losses", "losses", "losses", "losses", "losses", "losses", "losses"]), 8);
    // 0 pts, 3 left → max 6 ≥ hold 5, < promo 8 → at-risk, 3 wins to stay up
    expect(s.state).toBe("at-risk");
    expect(s.outlook).toBe("3 wins to stay up");
  });

  it("unknown division", () => {
    const s = seasonProgress(pad(["wins"]), 42);
    expect(s.division).toBeNull();
    expect(s.state).toBe("contending");
    expect(s.winsToTitle).toBeNull();
  });
});

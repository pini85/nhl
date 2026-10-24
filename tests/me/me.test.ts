import { describe, expect, it } from "vitest";
import { addSeen, parseMe, parseSeen, SEEN_MAX } from "@/lib/me";

const known = new Set(["1273735466"]);

describe("parseMe", () => {
  it("knows a picked teammate", () => expect(parseMe("1273735466", known)).toEqual({ kind: "player", playerId: "1273735466" }));
  it("treats an unknown player id as not set", () => expect(parseMe("999", known)).toEqual({ kind: "unset" }));
  it("knows guests and people who skipped", () => {
    expect(parseMe("guest", known)).toEqual({ kind: "guest" });
    expect(parseMe("skipped", known)).toEqual({ kind: "skipped" });
  });
  it("treats a missing or junk cookie as not set", () => {
    expect(parseMe(undefined, known)).toEqual({ kind: "unset" });
    expect(parseMe("<script>", known)).toEqual({ kind: "unset" });
  });
});

describe("parseSeen", () => {
  it("keeps valid ids and drops junk", () => expect(parseSeen("ab12,<script>,cd34,,")).toEqual(["ab12", "cd34"]));
  it("keeps at most the newest 60", () => {
    const ids = Array.from({ length: 500 }, (_, i) => `x${i}`);
    const seen = parseSeen(ids.join(","));
    expect(seen).toHaveLength(SEEN_MAX);
    expect(seen.at(-1)).toBe("x499");
  });
  it("handles a missing cookie", () => expect(parseSeen(undefined)).toEqual([]));
});

describe("addSeen", () => {
  it("adds new ids and drops ones that can no longer show", () => {
    expect(addSeen(["a1", "b2"], ["c3"], new Set(["b2", "c3"]))).toEqual(["b2", "c3"]);
  });
  it("never repeats an id", () => expect(addSeen(["b2"], ["b2"], new Set(["b2"]))).toEqual(["b2"]));
  it("ignores junk ids", () => expect(addSeen([], ["<x>"], new Set(["<x>"]))).toEqual([]));
});

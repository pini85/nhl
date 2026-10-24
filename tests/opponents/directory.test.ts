import { describe, expect, it } from "vitest";
import { opponentDirectory } from "@/lib/opponents/directory";

describe("opponentDirectory", () => {
  it("leaves out our own club even if someone scouted it", () => {
    const rows = opponentDirectory([], [{ clubId: 56507, name: "Drop drop drop", crestAssetId: null }, { clubId: 1, name: "Hello Buddy", crestAssetId: null }], new Map());
    expect(rows.map((r) => r.clubId)).toEqual([1]);
  });
});

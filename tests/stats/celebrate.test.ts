import { describe, expect, it } from "vitest";
import { celebrationFor } from "@/lib/stats/celebrate";

describe("celebrationFor", () => {
  it("promotion and title", () => {
    expect(celebrationFor("promotion-zone", 8, 2)).toEqual({ message: "⬆ Promotion clinched!", key: "celebrated:8:2:promotion-zone" });
    expect(celebrationFor("title-zone", 8, 2)?.message).toBe("🏆 Division title!");
  });
  it("nothing otherwise", () => {
    expect(celebrationFor("contending", 8, 2)).toBeNull();
    expect(celebrationFor("safe", 8, 2)).toBeNull();
  });
});

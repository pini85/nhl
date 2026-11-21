import { afterEach, describe, expect, it, vi } from "vitest";
import { startScoutRun } from "@/lib/github/dispatch";

afterEach(() => vi.unstubAllEnvs());

describe("startScoutRun", () => {
  it("does nothing without a token", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    const f = vi.fn();
    expect(await startScoutRun(f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("starts the scout workflow on main", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "t0ken");
    vi.stubEnv("GITHUB_REPO", "me/repo");
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await startScoutRun(f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/me/repo/actions/workflows/scout.yml/dispatches");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t0ken");
  });

  it("reports failure instead of throwing", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "t0ken");
    expect(await startScoutRun((async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBe(false);
  });
});

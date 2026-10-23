import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCollect = vi.fn();
const revalidateTag = vi.fn();
vi.mock("@/lib/collector/run", () => ({ runCollect }));
vi.mock("next/cache", () => ({ revalidateTag }));

const { GET } = await import("@/app/api/collect/route");

const url = "https://example.test/api/collect";
const summary = (n: number) => ({
  runId: 1,
  status: "ok",
  newMatches: n,
  recoveredMatches: 0,
  summaryMatches: 0,
  warnings: [],
  errors: [],
});

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  runCollect.mockReset();
  revalidateTag.mockReset();
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/collect", () => {
  it("401 without the secret", async () => {
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect(runCollect).not.toHaveBeenCalled();
  });

  it("401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request(url, { headers: { authorization: "Bearer undefined" } }));
    expect(res.status).toBe(401);
    expect(runCollect).not.toHaveBeenCalled();
  });

  it("runs and revalidates when games were added", async () => {
    runCollect.mockResolvedValue(summary(2));
    const res = await GET(new Request(url, { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ newMatches: 2 });
    expect(runCollect).toHaveBeenCalledWith("cron");
    expect(revalidateTag).toHaveBeenCalledWith("club-56507", "max");
  });

  it("does not revalidate when nothing changed", async () => {
    runCollect.mockResolvedValue(summary(0));
    await GET(new Request(url, { headers: { authorization: "Bearer s3cret" } }));
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

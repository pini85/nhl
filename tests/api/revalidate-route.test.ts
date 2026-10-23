import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));
const { POST } = await import("@/app/api/revalidate/route");

const url = "https://example.test/api/revalidate";
beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  revalidateTag.mockReset();
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("POST /api/revalidate", () => {
  it("401 without the secret", async () => {
    expect((await POST(new Request(url, { method: "POST" }))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the club tag", async () => {
    const res = await POST(new Request(url, { method: "POST", headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("club-56507", "max");
  });
});

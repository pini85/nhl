import { describe, expect, it } from "vitest";
import { eaFetch } from "@/lib/ea/http";

type Call = [string, RequestInit];

function stubFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    const next = responses.shift();
    if (!next) throw new Error("no more stub responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("eaFetch", () => {
  it("sends browser headers and builds the URL", async () => {
    const { calls, fetchImpl } = stubFetch([new Response("[]", { status: 200 })]);
    const r = await eaFetch(
      "clubs/matches",
      { platform: "common-gen5", clubIds: "56507", matchType: "gameType5" },
      { fetchImpl },
    );
    expect(r).toEqual({ ok: true, data: [] });
    expect(calls[0][0]).toBe(
      "https://proclubs.ea.com/api/nhl/clubs/matches?platform=common-gen5&clubIds=56507&matchType=gameType5",
    );
    const headers = calls[0][1].headers as Record<string, string>;
    expect(headers["Origin"]).toBe("https://www.ea.com");
    expect(headers["Referer"]).toBe("https://www.ea.com/");
    expect(headers["User-Agent"]).toContain("Chrome/130");
  });

  it("retries once on 5xx then succeeds", async () => {
    const { calls, fetchImpl } = stubFetch([
      new Response("oops", { status: 503 }),
      new Response('{"a":1}', { status: 200 }),
    ]);
    const r = await eaFetch("clubs/info", {}, { fetchImpl });
    expect(r).toEqual({ ok: true, data: { a: 1 } });
    expect(calls).toHaveLength(2);
  });

  it("returns http error on 403 without retrying past the limit", async () => {
    const { calls, fetchImpl } = stubFetch([
      new Response("denied", { status: 403 }),
      new Response("denied", { status: 403 }),
    ]);
    const r = await eaFetch("clubs/info", {}, { fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: "http", status: 403 });
    expect(calls).toHaveLength(2);
  });

  it("does not retry a 404", async () => {
    const { calls, fetchImpl } = stubFetch([new Response("nope", { status: 404 })]);
    const r = await eaFetch("clubs/info", {}, { fetchImpl });
    expect(!r.ok && r.error.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("returns invalid on non-JSON body", async () => {
    const { fetchImpl } = stubFetch([
      new Response("<HTML>Access Denied</HTML>", { status: 200 }),
    ]);
    const r = await eaFetch("clubs/info", {}, { fetchImpl });
    expect(!r.ok && r.error.kind).toBe("invalid");
  });

  it("returns network error when fetch throws", async () => {
    const { fetchImpl } = stubFetch([new TypeError("fetch failed"), new TypeError("fetch failed")]);
    const r = await eaFetch("clubs/info", {}, { fetchImpl });
    expect(!r.ok && r.error.kind).toBe("network");
  });
});

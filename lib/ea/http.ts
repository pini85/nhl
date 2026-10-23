import { EA_BASE } from "@/lib/config";

export type EaError = {
  kind: "http" | "network" | "invalid";
  status?: number;
  message: string;
};

export type EaResult<T> = { ok: true; data: T; warnings?: string[] } | { ok: false; error: EaError };

// EA's firewall rejects requests that don't look like a browser.
const EA_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.ea.com",
  Referer: "https://www.ea.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

const TIMEOUT_MS = 15_000;

function isRetryableStatus(status: number) {
  // 403 included: EA's edge sometimes rejects a request and accepts the next.
  return status >= 500 || status === 403;
}

export async function eaFetch(
  path: string,
  params: Record<string, string>,
  opts: { fetchImpl?: typeof fetch; retries?: number } = {},
): Promise<EaResult<unknown>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const retries = opts.retries ?? 1;
  const query = new URLSearchParams(params).toString();
  const url = `${EA_BASE}/${path}${query ? `?${query}` : ""}`;

  let lastError: EaError = { kind: "network", message: "not attempted" };
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: EA_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      lastError = { kind: "network", message: e instanceof Error ? e.message : String(e) };
      continue;
    }

    if (!res.ok) {
      lastError = { kind: "http", status: res.status, message: `EA responded ${res.status}` };
      if (isRetryableStatus(res.status)) continue;
      return { ok: false, error: lastError };
    }

    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: { kind: "invalid", message: `Non-JSON body: ${text.slice(0, 80)}` } };
    }
  }
  return { ok: false, error: lastError };
}

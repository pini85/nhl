// Starts the GitHub "scout" workflow, so a scout request is answered right away instead of
// on the next collector run. Needs GITHUB_DISPATCH_TOKEN (a token allowed to run workflows).
// Without it, or if GitHub doesn't answer, the request waits for the next collector run.
export async function startScoutRun(fetchFn: typeof fetch = fetch): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  const repo = process.env.GITHUB_REPO ?? "pini85/nhl";
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/scout.yml/dispatches`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

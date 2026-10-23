import { expect, test } from "@playwright/test";

async function ogImageOf(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  const url = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(url).toBeTruthy();
  return new URL(url!).pathname + new URL(url!).search;
}

for (const path of ["/", "/games/2782817800237", "/nights/2026-10-22", "/players/828785353", "/games/nope"]) {
  test(`link preview image for ${path}`, async ({ page, request }) => {
    const img = await ogImageOf(page, path);
    const res = await request.get(img);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
}

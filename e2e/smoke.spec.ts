import { expect, test } from "@playwright/test";

const pages = ["/", "/games", "/games/2782817800237", "/players", "/players/828785353", "/opponents"];

for (const path of pages) {
  test(`renders ${path} on a phone without errors or sideways scroll`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/screenshots/${path === "/" ? "home" : path.slice(1).replaceAll("/", "_")}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("home shows the division", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Division 8").first()).toBeVisible();
});

test("unknown game shows the not-found page", async ({ page }) => {
  await page.goto("/games/nope");
  await expect(page.getByText("Nothing here")).toBeVisible();
});

test("games filter hides other types", async ({ page }) => {
  await page.goto("/games");
  await page.getByRole("button", { name: "Playoffs" }).click();
  await expect(page.getByText("No games of this type yet.")).toBeVisible();
});

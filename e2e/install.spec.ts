import { expect, test } from "@playwright/test";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.49.87";

// The banner waits until onboarding is done or skipped; these tests start as someone who skipped it.
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "ddd-player", value: "skipped", url: "http://localhost:3400" }]);
});

const banner = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Get the app" });
const sheet = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Add Drop drop drop to your home screen" });

test("first plain visit shows no banner but the home card offers the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Get the app/ })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("banner shows after a scout result and opens the Android steps", async ({ page }) => {
  await page.goto("/clubs/1808");
  await expect(banner(page)).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/install-banner.png" });
  await banner(page).getByRole("button", { name: "Add" }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText("Install app")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/install-sheet-android.png" });
});

test("closing the banner keeps it away on the next pages", async ({ page }) => {
  await page.goto("/clubs/1808");
  await banner(page).getByRole("button", { name: "Not now" }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.goto("/nights/2026-10-22");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("uses Chrome's one-tap install when the browser offers it", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { prompted?: boolean };
    addEventListener("load", () => {
      const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
      e.prompt = async () => {
        w.prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      dispatchEvent(e);
    });
  });
  await page.goto("/clubs/1808");
  await banner(page).getByRole("button", { name: "Add" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(sheet(page)).toHaveCount(0);
  await expect(banner(page)).toHaveCount(0);
});

test.describe("on iPhone", () => {
  test.use({ userAgent: IPHONE });

  test("the group-chat link opens the Share-menu steps", async ({ page }) => {
    await page.goto("/?install=1");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByText("Add to Home Screen").first()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.screenshot({ path: "e2e/screenshots/install-sheet-ios.png" });
  });

  test("nothing is offered when it already runs from the home screen", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await page.goto("/clubs/1808");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByText("Division 8").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Get the app/ })).toHaveCount(0);
  });
});

test.describe("in Instagram's browser", () => {
  test.use({ userAgent: INSTAGRAM });

  test("tells people to open the page in Safari first", async ({ page }) => {
    await page.goto("/?install=1");
    await expect(sheet(page).getByText("You're in Instagram's browser", { exact: false })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Copy link" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/install-sheet-in-app.png" });
  });
});

test.describe("before onboarding", () => {
  test("the banner stays hidden until onboarding is finished or skipped", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/clubs/1808");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });
});

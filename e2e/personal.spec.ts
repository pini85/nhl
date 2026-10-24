import { expect, type Page, test } from "@playwright/test";

const PUCK = "1273735466"; // puck_control

const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });

test.describe("player pages", () => {
  test("show next milestones and how the player compares with the team", async ({ page }) => {
    await page.goto(`/players/${PUCK}`);
    await expect(heading(page, "Next milestones")).toBeVisible();
    await expect(heading(page, "Vs the team")).toBeVisible();
  });
});

const BASE = "http://localhost:3400";
const setPlayer = (page: Page, value: string) => page.context().addCookies([{ name: "ddd-player", value, url: BASE }]);

test.describe("Me tab", () => {
  test("shows your own numbers when you've picked yourself", async ({ page }) => {
    await setPlayer(page, PUCK);
    await page.goto("/me");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("puck_control");
    await expect(heading(page, "Your next milestones")).toBeVisible();
    await expect(page.getByRole("button", { name: "Not you? Switch player" })).toBeVisible();
  });

  test("lets you pick yourself, then switch", async ({ page }) => {
    await setPlayer(page, "skipped");
    await page.goto("/me");
    await expect(heading(page, "Set up your profile")).toBeVisible();
    await page.getByRole("button", { name: /^puck_control/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("puck_control");
    await expect(page).toHaveURL(/\/me$/);
    await expect(heading(page, "Your next milestones")).toBeVisible();
    await page.getByRole("button", { name: "Not you? Switch player" }).click();
    await page.getByRole("button", { name: /^ThePooker/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ThePooker");
  });

  test("treats an unknown player id as not set up", async ({ page }) => {
    await setPlayer(page, "999");
    await page.goto("/me");
    await expect(heading(page, "Set up your profile")).toBeVisible();
  });

  test("guests can still pick a player", async ({ page }) => {
    await setPlayer(page, "guest");
    await page.goto("/me");
    await expect(page.getByText("You said you're not on the team.")).toBeVisible();
    await page.getByRole("button", { name: "Pick your player" }).click();
    await expect(page.getByRole("button", { name: /^puck_control/ })).toBeVisible();
  });

  test("bottom nav has a Me tab and fits the phone", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Me", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const onboarding = (page: Page) => page.getByRole("dialog", { name: "Set up Drop drop drop" });

test.describe("onboarding", () => {
  test("first visit to Home: pick yourself, skip install, land on your card", async ({ page }) => {
    await page.goto("/");
    await expect(onboarding(page).getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await page.waitForTimeout(400); // let the fade-in finish before the screenshot
    await page.screenshot({ path: "e2e/screenshots/onboarding-who.png" });
    await onboarding(page).getByRole("button", { name: /^puck_control/ }).click();
    await expect(onboarding(page).getByRole("heading", { name: "Get your stats one tap away, puck_control" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/onboarding-install.png" });
    await onboarding(page).getByRole("button", { name: "Not now" }).click();
    await expect(onboarding(page).getByRole("heading", { name: "You're all set, puck_control" })).toBeVisible();
    await onboarding(page).getByRole("button", { name: "Let's go" }).click();
    await expect(onboarding(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Division 8" }).or(page.getByText("Division 8").first())).toBeVisible();
    await expect(onboarding(page)).toHaveCount(0);
  });

  test("a shared link to a game doesn't start onboarding", async ({ page }) => {
    await page.goto("/games/2782817800237");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(onboarding(page)).toHaveCount(0);
  });

  test("skip keeps it away and leaves a way back on the Me tab", async ({ page }) => {
    await page.goto("/");
    await onboarding(page).getByRole("button", { name: "Skip" }).click();
    await expect(onboarding(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Division 8").first()).toBeVisible();
    await expect(onboarding(page)).toHaveCount(0);
    await page.goto("/me");
    await expect(heading(page, "Set up your profile")).toBeVisible();
  });

  test("'I'm not on the team' closes it for good", async ({ page }) => {
    await page.goto("/");
    await onboarding(page).getByRole("button", { name: "I'm not on the team" }).click();
    await expect(onboarding(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Division 8").first()).toBeVisible();
    await expect(onboarding(page)).toHaveCount(0);
  });

  test.describe("as the iPhone home-screen app", () => {
    test.use({ userAgent: IPHONE });
    test("welcomes you and skips the install step", async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
      await page.goto("/");
      await expect(onboarding(page).getByRole("heading", { name: "Welcome to the app! Who are you?" })).toBeVisible();
      await onboarding(page).getByRole("button", { name: /^puck_control/ }).click();
      await expect(onboarding(page).getByRole("heading", { name: "You're all set, puck_control" })).toBeVisible();
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    test("never covers Home", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Division 8").first()).toBeVisible();
      await expect(onboarding(page)).toHaveCount(0);
    });
  });
});

test.describe("Home", () => {
  test("greets a picked teammate with their own card", async ({ page }) => {
    await setPlayer(page, PUCK);
    await page.goto("/");
    const card = page.getByRole("link", { name: /Hey puck_control/ });
    await expect(card).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/home-personal.png" });
    await card.click();
    await expect(page).toHaveURL(/\/me$/);
  });

  test("nudges people who skipped onboarding", async ({ page }) => {
    await setPlayer(page, "skipped");
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Set up your profile/ })).toBeVisible();
  });

  test("shows nothing personal for people not on the team", async ({ page }) => {
    await setPlayer(page, "guest");
    await page.goto("/");
    await expect(page.getByText("Division 8").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Set up your profile|Hey / })).toHaveCount(0);
  });

  test("a closed moment card stays gone after reload (skipped when no moment in the last 14 days)", async ({ page }) => {
    await setPlayer(page, "guest");
    await page.goto("/");
    await expect(page.getByText("Division 8").first()).toBeVisible();
    const first = page.locator("[data-moment]").first();
    test.skip((await first.count()) === 0, "no moments in the live data's last 14 days");
    const id = await first.getAttribute("data-moment");
    await first.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.locator(`[data-moment="${id}"]`)).toHaveCount(0);
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "ddd-seen")?.value ?? "").toContain(id!);
    await page.reload();
    await expect(page.getByText("Division 8").first()).toBeVisible();
    await expect(page.locator(`[data-moment="${id}"]`)).toHaveCount(0);
  });
});

test.describe("You highlight", () => {
  const youTag = (page: Page) =>
    page.locator(`a[href="/players/${PUCK}"]`).first().evaluate((el) => getComputedStyle(el, "::after").content);

  test("tags your name in a box score", async ({ page }) => {
    await setPlayer(page, PUCK);
    await page.goto("/games/2782817800237");
    await expect(page.locator(`a[href="/players/${PUCK}"]`).first()).toBeVisible();
    await expect.poll(() => youTag(page)).toBe('"You"');
    await page.locator(`tr:has(a[href="/players/${PUCK}"])`).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "e2e/screenshots/you-highlight.png" });
  });

  test("tags nothing without a pick", async ({ page }) => {
    await setPlayer(page, "skipped");
    await page.goto("/games/2782817800237");
    await expect(page.locator(`a[href="/players/${PUCK}"]`).first()).toBeVisible();
    expect(await youTag(page)).toBe("none");
  });
});

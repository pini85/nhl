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

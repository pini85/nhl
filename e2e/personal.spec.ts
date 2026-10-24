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

import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// architecture.md, task 45b: the leaderboard screen (Figma 3:3639) reads the boards of task 45a.
test("opens the standings from the catalog and switches boards", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/challenges");
  await page.getByRole("link", { name: "Leaderboard" }).click();

  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole("heading", { name: "Global Engineering Standings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Weekly/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("METRICS (XP)")).toBeVisible();
  await expect(page.getByText("YOUR ROW")).toBeVisible();
  // Friends has no data yet: it is shown, but not as a link.
  await expect(page.getByRole("link", { name: /Friends/ })).toHaveCount(0);

  await page.getByRole("link", { name: /By Skill/ }).click();
  await expect(page).toHaveURL(/\/leaderboard\?tab=skill$/);
  await expect(page.getByText("SKILL RATING", { exact: true })).toBeVisible();
});

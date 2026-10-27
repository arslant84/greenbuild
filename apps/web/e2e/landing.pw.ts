import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// architecture.md, task 55: the public landing page (Figma 3:411).
test("the landing page leads to the catalog", async ({ page }) => {
  // The landing is public; the catalog needs a signed-in player (task 30e).
  await signInForTest(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fix the broken system/ })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Challenges" }).click();
  await expect(page).toHaveURL(/\/challenges$/);
});

test("the header's Leaderboard, Sign in and avatar lead a visitor on", async ({ page }) => {
  // A visitor reaches the leaderboard and their profile through sign-in, which brings them back after.
  for (const [name, url] of [
    ["Sign in", /\/signin$/],
    ["Leaderboard", /\/signin\?callbackUrl=%2Fleaderboard$/],
    ["Your profile", /\/signin\?callbackUrl=%2Fprofile$/],
  ] as const) {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
});

test("the leaderboard preview opens the leaderboard", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("link", { name: /View all ranked engineers/ }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

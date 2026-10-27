import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// architecture.md, task 55: the public landing page (Figma 3:411).
test("the landing page leads a visitor to the catalog through sign-in", async ({ page }) => {
  // The landing is public; the catalog needs a signed-in player (task 30e).
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fix the broken system/ })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Challenges" }).click();
  await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fchallenges$/);
});

// Deviation 35 (owner, 2026-10-27): the brand links home from every screen, and home for a signed-in
// player is their Daily screen.
test("the brand leads a signed-in player to the Daily screen", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/play$/);

  await page.goto("/challenges");
  await page.getByRole("link", { name: ">_ greenbuild" }).click();
  await expect(page).toHaveURL(/\/play$/);
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

test("the leaderboard preview leads a visitor to the leaderboard through sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /View all ranked engineers/ }).click();
  await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fleaderboard$/);
});

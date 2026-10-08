import { expect, test } from "@playwright/test";

// architecture.md, task 55: the Welcome step of First-Time Onboarding leads to the Daily screen (owner, 2026-10-08).
test("Let's go opens the Daily screen", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to greenbuild." })).toBeVisible();
  await page.getByRole("link", { name: /Let's go/ }).click();
  await expect(page).toHaveURL(/\/play$/);
});

test("Enter continues as the hint says", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to greenbuild." })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play$/);
});

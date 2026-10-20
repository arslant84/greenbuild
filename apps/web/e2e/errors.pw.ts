import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// architecture.md, task 55: Figma's E1 card for pages that do not exist.
test("an unknown page answers 404 and leads back to today's challenge", async ({ page }) => {
  // Today's challenge needs a signed-in player (task 30e); the 404 page does not.
  await signInForTest(page);
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: /Go to today's challenge/ }).click();
  await expect(page).toHaveURL(/\/play$/);
});

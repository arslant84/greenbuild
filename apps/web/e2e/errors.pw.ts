import { expect, test } from "@playwright/test";

// architecture.md, task 55: Figma's E1 card for pages that do not exist.
test("an unknown page answers 404 and leads back to today's challenge", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: /Go to today's challenge/ }).click();
  await expect(page).toHaveURL(/\/play$/);
});

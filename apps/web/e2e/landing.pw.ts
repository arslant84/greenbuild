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

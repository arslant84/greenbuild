import { expect, test } from "@playwright/test";

// architecture.md, task 55: the public landing page (Figma 3:411).
test("the landing page leads to the catalog", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fix the broken system/ })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Challenges" }).click();
  await expect(page).toHaveURL(/\/challenges$/);
});

import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// architecture.md, task 47b: the settings screen (Figma 7:10273).
test("the catalog's Settings link opens the settings", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/challenges");
  await page.getByRole("link", { name: "Settings", exact: true }).first().click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Settings / Config")).toBeVisible();
});

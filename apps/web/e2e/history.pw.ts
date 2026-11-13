import { expect, test } from "@playwright/test";
import { solvedYesterdaysDaily } from "./play-db";
import { signInForTest } from "./test-player";

// The history screen (deviation 36) reads GET /v1/me/attempts, as the Daily screen's history blocks do.
test("View all history lists yesterday's solved daily, which opens its debrief", async ({ page }) => {
  const attemptId = await solvedYesterdaysDaily(await signInForTest(page), "nginx-502-upstream");
  await page.goto("/play");
  await page.getByRole("link", { name: /View all history/ }).click();
  await expect(page).toHaveURL(/\/play\/history$/);

  await expect(page.getByText("XP earned").locator("..")).toContainText("150 XP");
  const row = page.getByRole("row").filter({ hasText: `#${attemptId.slice(-8).toUpperCase()}` });
  for (const cell of ["PASSED", "DAILY", "The site returns 502", "04m 15s", "+150 XP"]) {
    await expect(row).toContainText(cell);
  }
  await row.getByRole("link", { name: "The site returns 502" }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${attemptId}/result$`));
});

test("the Catalog filter leaves out daily attempts", async ({ page }) => {
  await solvedYesterdaysDaily(await signInForTest(page), "nginx-502-upstream");
  await page.goto("/play/history");

  await page.getByRole("navigation", { name: "Filter by mode" }).getByRole("link", { name: "Catalog" }).click();
  await expect(page).toHaveURL(/\/play\/history\?mode=catalog$/);
  await expect(page.getByText("No attempts yet")).toBeVisible();
  await expect(page.getByRole("link", { name: /Play today's daily/ })).toHaveAttribute("href", "/play");
});

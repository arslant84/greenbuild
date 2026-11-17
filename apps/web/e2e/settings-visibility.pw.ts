import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { setHandle } from "./play-db";
import { signInForTest } from "./test-player";

// The settings screen sets the player's country (the Country leaderboard is theirs) and whether their game
// profile is public, through PATCH /v1/me.
test("a chosen country is saved and opens the player's Country board", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/leaderboard?tab=country");
  await expect(page.getByText("Set your country to see its board.")).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("Location / Jurisdiction").selectOption({ label: "Kazakhstan" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText(/Changes saved/);
  await page.reload();
  await expect(page.getByLabel("Location / Jurisdiction")).toHaveValue("KZ");

  await page.goto("/leaderboard?tab=country");
  await expect(page.getByText("Set your country to see its board.")).toHaveCount(0);
});

test("Hidden takes the public profile away from visitors, and Public brings it back", async ({ page, browser }) => {
  const handle = `h-${randomUUID().slice(0, 8)}`;
  await setHandle(await signInForTest(page), handle);
  const visitor = await browser.newPage();
  await page.goto("/settings");
  const visibility = page.getByRole("radiogroup", { name: "Game profile visibility" });
  await expect(visibility.getByRole("radio", { name: /^Public/ })).toBeChecked();
  await expect(visibility.getByRole("radio", { name: /^Companies only/ })).toBeDisabled();

  await visibility.getByText("Hidden", { exact: true }).click();
  await expect(visibility.getByRole("radio", { name: /^Hidden/ })).toBeChecked();
  expect((await visitor.goto(`/u/${handle}`))?.status()).toBe(404);

  await visibility.getByText("Public", { exact: true }).click();
  await expect(visibility.getByRole("radio", { name: /^Public/ })).toBeChecked();
  expect((await visitor.goto(`/u/${handle}`))?.status()).toBe(200);
  await visitor.close();
});

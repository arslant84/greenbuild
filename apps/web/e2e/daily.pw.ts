import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { setHandle } from "./play-db";
import { signInForTest } from "./test-player";

// These screens need a signed-in player (task 30e).
test.beforeEach(async ({ page }) => {
  await signInForTest(page);
});

// architecture.md, task 41c: the Daily screen shows the challenge the worker published for today, not
// a hardcoded one. The play stack publishes nginx-502 on its first day (scripts/play-stack.sh).
test("the Daily screen shows today's published challenge", async ({ page }) => {
  await page.goto("/play");

  await expect(page.getByText("The site returns 502")).toBeVisible();
  await expect(page.getByText("sandbox-env // nginx-502-upstream")).toBeVisible();
  await expect(page.getByRole("button", { name: /Start Challenge/ })).toBeEnabled();
});

test("the sidebar opens the catalog, the leaderboards and the profile", async ({ page }) => {
  const sidebar = page.getByRole("complementary");
  for (const [label, path] of [["Catalog", "/challenges"], ["Leaderboards", "/leaderboard"], ["Profile", "/settings"]] as const) {
    await page.goto("/play");
    await sidebar.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("the sidebar shows the player and opens their public profile", async ({ page }) => {
  const handle = `d-${randomUUID().slice(0, 8)}`;
  await setHandle(await signInForTest(page), handle);
  await page.goto("/play");

  await page.getByRole("complementary").getByRole("link", { name: new RegExp(`@${handle}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
});

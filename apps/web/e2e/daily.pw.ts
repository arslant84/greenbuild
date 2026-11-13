import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { onWeeklyBoard } from "./play-boards";
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

// The daily follows the UTC calendar, so the next one arrives at 00:00 UTC; the browser's clock is fixed.
test("the status bar counts down to the next daily challenge", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-13T21:30:00Z") });
  await page.goto("/play", { waitUntil: "networkidle" });
  // The installed clock runs on while the page loads, so it is moved to a fixed moment and stopped there;
  // the countdown changes on its next one-second tick.
  await page.clock.pauseAt(new Date("2026-11-13T22:00:00Z"));
  const countdown = page.getByText(/^Next scenario in/);

  await page.clock.runFor(1_000);
  await expect(countdown).toHaveText("Next scenario in 01:59:59");
  await page.clock.runFor(2_000);
  await expect(countdown).toHaveText("Next scenario in 01:59:57");
});

test("Top 5 This Week lists the weekly board's leader, who opens their profile", async ({ page }) => {
  const handle = `t-${randomUUID().slice(0, 8)}`;
  const email = await signInForTest(page);
  await setHandle(email, handle);

  await onWeeklyBoard(email, async () => {
    await page.goto("/play");
    await expect(page.getByText(/^WK \d+$/)).toBeVisible();
    const leader = page.getByRole("listitem").filter({ hasText: "#1" });
    await expect(leader).toContainText(`@${handle}`);
    await expect(leader).toContainText("XP");
    await leader.getByRole("link", { name: `@${handle}` }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  });
});

test("Global ladder opens the leaderboard", async ({ page }) => {
  await page.goto("/play");
  await page.getByRole("link", { name: /Global ladder/ }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

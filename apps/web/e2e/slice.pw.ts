import { expect, test } from "@playwright/test";
import { CHECK_TIMEOUT_MS, check, startChallenge, typeFix } from "./daily-solve";
import { signInForTest } from "./test-player";

// architecture.md, task 16: Start → wait for ready → terminal → Check → result, on the real stack, as a
// signed-in player (task 30d).
// The worker relays attempt.finished and credits XP and the streak within seconds of the solve.
const XP_TIMEOUT_MS = 30_000;

test("a player solves nginx-502 from the Daily screen to the debrief", async ({ page }) => {
  await signInForTest(page);
  await startChallenge(page);

  await check(page);
  await expect(page.getByText(/Check failed:/)).toBeVisible({ timeout: CHECK_TIMEOUT_MS });
  await expect(page.getByText("9 checks remaining")).toBeVisible();

  await typeFix(page);

  await check(page);
  await expect(page.getByText(/INCIDENT RESOLVED IN/)).toBeVisible({ timeout: CHECK_TIMEOUT_MS });
  await expect(page.getByText("2/10 checks used")).toBeVisible();

  await page.getByRole("link", { name: /\/play\/.*\/result/ }).click();
  await expect(page.getByText("SOLVED", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1/2 checks passed")).toBeVisible();

  // Task 42b: the worker credits the solve, and the Daily status bar shows today's XP.
  await expect
    .poll(
      async () => {
        await page.goto("/play");
        return page.getByText(/XP TODAY/).textContent();
      },
      { timeout: XP_TIMEOUT_MS },
    )
    .not.toBe("+0 XP TODAY");

  // Task 44: the worker counts the solve, and the streak shows its first day.
  await expect
    .poll(
      async () => {
        await page.goto("/play");
        return page.getByText(/^Day \d+$/).textContent();
      },
      { timeout: XP_TIMEOUT_MS },
    )
    .toBe("Day 1");
});

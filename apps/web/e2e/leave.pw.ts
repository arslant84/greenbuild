import { expect, type Page, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// These screens need a signed-in player (task 30e).
test.beforeEach(async ({ page }) => {
  await signInForTest(page);
});

// architecture.md, task 19c: "Exit Attempt" and "Give up" end the attempt, so the player can start again.
const SANDBOX_START_TIMEOUT_MS = 90_000;

async function startChallenge(page: Page): Promise<void> {
  await page.goto("/play");
  await page.getByRole("button", { name: /Start Challenge/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
}

test("Exit Attempt ends the attempt and the player can start again", async ({ page }) => {
  await startChallenge(page);

  await page.getByRole("button", { name: "Exit Attempt" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Start Challenge/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
});

test("Give up ends the attempt and opens its debrief", async ({ page }) => {
  await startChallenge(page);

  await page.getByRole("button", { name: /Give up attempt/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}\/result$/);
  await expect(page.getByText("ABANDONED", { exact: true }).first()).toBeVisible();
});

test("the debrief's Credential tab jumps to the credential card", async ({ page }) => {
  await startChallenge(page);
  await page.getByRole("button", { name: /Give up attempt/ }).click();
  await expect(page).toHaveURL(/\/result$/);

  await page.getByRole("link", { name: "Credential", exact: true }).click();
  await expect(page).toHaveURL(/\/result#credential$/);
  await expect(page.locator("#credential")).toBeInViewport();
});

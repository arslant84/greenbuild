import { expect, test } from "@playwright/test";

const PLAY_PATH = /\/play$/;
const KEY_TIMEOUT_MS = 2_000;
const CONTINUE_TIMEOUT_MS = 30_000;

// architecture.md, task 55: the Welcome step of First-Time Onboarding leads to the Daily screen (owner, 2026-10-08).
test("Let's go opens the Daily screen", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to greenbuild." })).toBeVisible();
  await page.getByRole("link", { name: /Let's go/ }).click();
  await expect(page).toHaveURL(PLAY_PATH);
});

test("Enter continues as the hint says", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to greenbuild." })).toBeVisible();
  // The page listens for Enter once it hydrates, after the server-rendered heading shows, so a press that
  // lands before then is lost; it is repeated until the Daily screen opens.
  await expect(async () => {
    if (!PLAY_PATH.test(page.url())) {
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(PLAY_PATH, { timeout: KEY_TIMEOUT_MS });
  }).toPass({ timeout: CONTINUE_TIMEOUT_MS });
});

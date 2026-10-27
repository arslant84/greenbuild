import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startChallenge } from "./daily-solve";
import { setHandle } from "./play-db";
import { signInForTest } from "./test-player";

// architecture.md, task 56: phone layouts. Each screen fits a phone without sideways scrolling, and its main
// controls sit inside the screen's width.
const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE });

async function expectFitsPhone(page: Page, controls: Locator[]): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= PHONE.width).toBe(true);
  }
}

test("the sign-in screen fits a phone", async ({ page }) => {
  await page.goto("/signin");

  await expectFitsPhone(page, [page.getByLabel("Work or personal email"), page.getByLabel("I am 16 or older"), page.getByRole("button", { name: "Send magic link" })]);
});

test("the landing fits a phone, and its menu opens the navigation", async ({ page }) => {
  await page.goto("/");

  await expectFitsPhone(page, [page.getByRole("link", { name: /Start today's challenge/ }), page.getByRole("link", { name: "Start", exact: true })]);
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("link", { name: "Challenges" })).toBeVisible();
});

test("the terms and the privacy policy fit a phone", async ({ page }) => {
  for (const path of ["/terms", "/privacy"]) {
    await page.goto(path);
    await expectFitsPhone(page, [page.getByRole("heading", { level: 1 })]);
  }
});

test("a public profile fits a phone, and its menu opens the navigation", async ({ page }) => {
  const handle = `p-${randomUUID().slice(0, 8)}`;
  await setHandle(await signInForTest(page), handle);
  await page.goto(`/u/${handle}`);

  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), page.getByLabel("Menu")]);
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("link", { name: "Leaderboards" })).toBeVisible();
});

test("the leaderboard fits a phone, and its menu opens the navigation", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/leaderboard");

  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), page.getByLabel("Menu")]);
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("link", { name: "Challenges" })).toBeVisible();
});

test("the Daily screen fits a phone, and its menu opens the navigation", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/play");

  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), page.getByRole("button", { name: /Start Challenge/ }), page.getByLabel("Menu")]);
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("the catalog fits a phone, and its Filters button opens the filters", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/challenges");

  const filters = page.getByText("Filters", { exact: true }).filter({ visible: true });
  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), filters, page.getByLabel("Menu")]);
  await filters.click();
  await expect(page.getByRole("link", { name: "Reset" })).toBeVisible();
});

test("the debrief fits a phone", async ({ page }) => {
  await signInForTest(page);
  await startChallenge(page);
  await page.getByRole("button", { name: /Give up attempt/ }).click();
  await expect(page).toHaveURL(/\/result$/);

  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), page.getByRole("link", { name: /RETURN TO OPERATIONS CONSOLE/ })]);
});

test("the settings fit a phone, and the menu opens the navigation", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/settings");

  await expectFitsPhone(page, [page.getByRole("heading", { name: "Profile Settings" }), page.getByRole("button", { name: "Save changes" }), page.getByLabel("Menu")]);
  await page.getByLabel("Menu").click();
  await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();
});

test("the onboarding fits a phone", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/onboarding");

  await expectFitsPhone(page, [page.getByRole("heading", { level: 1 }), page.getByRole("link", { name: "Skip intro" }), page.getByRole("link", { name: /Let's go/ })]);});

test("the 404 page fits a phone", async ({ page }) => {
  await page.goto("/no-such-page");

  await expectFitsPhone(page, [page.getByRole("heading", { name: "Page not found" }), page.getByRole("link", { name: /Go to today's challenge/ })]);
});

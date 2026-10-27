import { expect, type Locator, type Page, test } from "@playwright/test";
import { signInForTest } from "./test-player";

// These screens need a signed-in player (task 30e).
test.beforeEach(async ({ page }) => {
  await signInForTest(page);
});

// architecture.md, task 36b: find a challenge in the catalog by skill and start it.
const SANDBOX_START_TIMEOUT_MS = 90_000;
const NGINX_502_TITLE = "The site returns 502";
const ATTEMPT_PATH = /\/play\/[0-9a-f-]{36}$/;
const CLICK_TIMEOUT_MS = 5_000;
const START_TIMEOUT_MS = 60_000;

function card(page: Page, title: string): Locator {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
}

async function startFromCatalog(page: Page): Promise<string> {
  await page.goto("/challenges");
  await page.getByRole("link", { name: /nginx/ }).first().click();
  await expect(page).toHaveURL(/\/challenges\?skill=nginx$/);
  await expect(page.getByRole("article").filter({ hasNotText: "nginx" })).toHaveCount(0);
  // The catalog has more nginx challenges than one page shows, so the search narrows it to this one.
  await page.getByRole("textbox", { name: "Search challenges" }).fill(NGINX_502_TITLE);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/challenges\?skill=nginx&q=/);
  // A click that lands while the search results render, before the button is live, does nothing; it is
  // repeated until the attempt opens (a click in flight disables the button, so one attempt starts).
  const start = card(page, NGINX_502_TITLE).getByRole("button", { name: /Start/ });
  await expect(async () => {
    if (!ATTEMPT_PATH.test(page.url())) {
      await start.click({ timeout: CLICK_TIMEOUT_MS });
    }
    await expect(page).toHaveURL(ATTEMPT_PATH, { timeout: CLICK_TIMEOUT_MS });
  }).toPass({ timeout: START_TIMEOUT_MS });
  return new URL(page.url()).pathname;
}

test("finds a challenge by skill and starts it", async ({ page }) => {
  await startFromCatalog(page);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
});

test("shows the running attempt in the catalog and resumes it", async ({ page }) => {
  const attemptPath = await startFromCatalog(page);
  await page.goto(`/challenges?q=${encodeURIComponent(NGINX_502_TITLE)}`);
  const started = card(page, NGINX_502_TITLE);
  await expect(started.getByText("In Progress")).toBeVisible();
  await started.getByRole("link", { name: /Resume/ }).click();
  await expect(page).toHaveURL(new RegExp(`${attemptPath}$`));
});

test("the header's avatar opens the player's profile, the settings without a handle", async ({ page }) => {
  await page.goto("/challenges");
  await page.getByRole("link", { name: "Your profile" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

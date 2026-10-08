import { expect, type Locator, type Page, test } from "@playwright/test";

// architecture.md, task 36b: find a challenge in the catalog by skill and start it.
const SANDBOX_START_TIMEOUT_MS = 90_000;
const NGINX_502_TITLE = "The site returns 502";

function card(page: Page, title: string): Locator {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
}

async function startFromCatalog(page: Page): Promise<string> {
  await page.goto("/challenges");
  await page.getByRole("link", { name: /nginx/ }).first().click();
  await expect(page).toHaveURL(/\/challenges\?skill=nginx$/);
  await expect(page.getByRole("article").filter({ hasNotText: "nginx" })).toHaveCount(0);
  await card(page, NGINX_502_TITLE).getByRole("button", { name: /Start/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

test("finds a challenge by skill and starts it", async ({ page }) => {
  await startFromCatalog(page);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
});

test("shows the running attempt in the catalog and resumes it", async ({ page }) => {
  const attemptPath = await startFromCatalog(page);
  await page.goto("/challenges");
  const started = card(page, NGINX_502_TITLE);
  await expect(started.getByText("In Progress")).toBeVisible();
  await started.getByRole("link", { name: /Resume/ }).click();
  await expect(page).toHaveURL(new RegExp(`${attemptPath}$`));
});

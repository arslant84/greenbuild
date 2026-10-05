import { expect, type Locator, type Page, test } from "@playwright/test";

// architecture.md, task 22 (until decision D5): screens are at least 1280 px wide, centered on wider
// windows, and nothing on the sandbox screen is cut off.
const SANDBOX_START_TIMEOUT_MS = 90_000;
const VIEWPORTS = [
  { width: 1280, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function expectInsideWindow(page: Page, element: Locator): Promise<void> {
  const box = await element.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  if (!box || !viewport) {
    return;
  }
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

for (const viewport of VIEWPORTS) {
  test(`the sandbox screen fits a ${viewport.width}×${viewport.height} window`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/play");
    await page.getByRole("button", { name: /Start Challenge/ }).click();
    await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });

    await expectInsideWindow(page, page.getByRole("button", { name: /Check Solution/ }));
    await expectInsideWindow(page, page.getByRole("button", { name: "Exit Attempt" }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test("the Daily frame is centered on a 1920 px window", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/play");

  const brand = await page.getByText(">_ greenbuild").boundingBox();
  expect(brand?.x).toBeGreaterThanOrEqual((1920 - 1280) / 2);
  expect(brand?.x).toBeLessThan((1920 - 1280) / 2 + 32);
});

test("the debrief header lines up with its content on a 1920 px window", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/play");
  await page.getByRole("button", { name: /Start Challenge/ }).click();
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
  await page.getByRole("button", { name: /Give up attempt/ }).click();
  await expect(page).toHaveURL(/\/result$/);

  const brand = await page.getByRole("link", { name: ">_ greenbuild" }).boundingBox();
  const content = await page.locator("main").boundingBox();
  expect(brand?.x).toBeCloseTo(content?.x ?? -1, 0);
});

test("a window narrower than 1280 px scrolls instead of squeezing the frame", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/play");

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

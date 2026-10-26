import { expect, test } from "@playwright/test";
import { solveDailyChallenge } from "./daily-solve";
import { signInForTest } from "./test-player";

// architecture.md, task 51: a solved attempt's share link opens for any visitor, on a phone too (task 56),
// carries the card as its link preview image, and stops working once revoked.
const WRITE_HEADERS = { "x-greenbuild-request": "1" };
// Visitors from a shared link often open it on a phone (task 56).
const PHONE = { width: 390, height: 844 };

test("a shared result opens for a visitor with its preview image, and not after it is revoked", async ({ page, browser }) => {
  await signInForTest(page);
  await solveDailyChallenge(page);
  const attemptId = new URL(page.url()).pathname.split("/")[2] ?? "";
  const shared = await page.request.post(`/api/attempts/${attemptId}/share`, { headers: WRITE_HEADERS });
  expect(shared.status()).toBe(200);
  const { token } = (await shared.json()) as { token: string };

  const visitor = await browser.newContext({ viewport: PHONE });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/s/${token}`);
  await expect(visitorPage.getByRole("region", { name: "Proof of incident resolution" })).toContainText("The site returns 502");
  expect(await visitorPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);
  const previewImage = await visitorPage.locator('meta[property="og:image"]').getAttribute("content");
  expect(previewImage?.endsWith(`/s/${token}/image.png`)).toBe(true);
  const image = await visitorPage.request.get(`/s/${token}/image.png`);
  expect([image.status(), image.headers()["content-type"]]).toEqual([200, "image/png"]);

  expect((await page.request.delete(`/api/attempts/${attemptId}/share`, { headers: WRITE_HEADERS })).status()).toBe(204);
  expect((await visitorPage.request.get(`/s/${token}`)).status()).toBe(404);
  expect((await visitorPage.request.get(`/s/${token}/image.png`)).status()).toBe(404);
  await visitor.close();
});

test("the debrief copies the public link and downloads the card", async ({ page, browser }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signInForTest(page);
  await solveDailyChallenge(page);
  await page.goto(`${new URL(page.url()).pathname}/result`);

  await page.getByRole("button", { name: "Copy verification link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
  expect(download.suggestedFilename()).toBe("greenbuild-result.png");

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(link);
  await expect(visitorPage.getByRole("region", { name: "Proof of incident resolution" })).toContainText("The site returns 502");
  await visitor.close();
});

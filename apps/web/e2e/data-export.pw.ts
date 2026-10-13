import { expect, test } from "@playwright/test";
import { linkInEmail } from "./mailpit";
import { signInForTest } from "./test-player";

// architecture.md, "Права пользователя", task 50a: a player asks for their data, gets a link by email
// and downloads the archive; nobody else can.
const WRITE_HEADERS = { "x-greenbuild-request": "1" };
const EXPORT_LINK = /https?:\/\/\S+\/api\/me\/export\/[0-9a-f-]{36}/;
// The worker's export job runs once a minute.
const EXPORT_EMAIL_TIMEOUT_MS = 90_000;

test("emails a link to the data export, which downloads for its owner only", async ({ page, browser }) => {
  const email = await signInForTest(page);
  expect((await page.request.post("/api/me/export", { headers: WRITE_HEADERS })).status()).toBe(202);
  const link = await linkInEmail(page.request, { to: email, subject: "Your greenbuild data export", link: EXPORT_LINK, timeout: EXPORT_EMAIL_TIMEOUT_MS });

  const download = await page.request.get(link);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toMatch(/^attachment; filename="greenbuild-export-\d{4}-\d{2}-\d{2}\.json"$/);
  expect(await download.json()).toMatchObject({ format: 1, account: { email } });

  const other = await (await browser.newContext()).newPage();
  await signInForTest(other);
  expect((await other.request.get(link)).status()).toBe(404);
  await other.context().close();
});

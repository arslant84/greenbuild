import { expect, test } from "@playwright/test";
import { solveDailyChallenge } from "./daily-solve";
import { signInForTest } from "./test-player";

// architecture.md, task 51: a solved attempt's share link gives any visitor the card as an image, until
// it is revoked.
const WRITE_HEADERS = { "x-greenbuild-request": "1" };

test("a shared result's image opens for a visitor, and not after it is revoked", async ({ page, browser }) => {
  await signInForTest(page);
  await solveDailyChallenge(page);
  const attemptId = new URL(page.url()).pathname.split("/")[2] ?? "";
  const shared = await page.request.post(`/api/attempts/${attemptId}/share`, { headers: WRITE_HEADERS });
  expect(shared.status()).toBe(200);
  const { token } = (await shared.json()) as { token: string };

  const visitor = await browser.newContext();
  const image = await visitor.request.get(`/s/${token}/image.png`);
  expect([image.status(), image.headers()["content-type"]]).toEqual([200, "image/png"]);

  expect((await page.request.delete(`/api/attempts/${attemptId}/share`, { headers: WRITE_HEADERS })).status()).toBe(204);
  expect((await visitor.request.get(`/s/${token}/image.png`)).status()).toBe(404);
  await visitor.close();
});

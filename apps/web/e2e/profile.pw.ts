import { randomUUID } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { solveDailyChallenge } from "./daily-solve";
import { hideGameProfile, setHandle } from "./play-db";
import { signInForTest } from "./test-player";

// architecture.md, task 46b: the public profile (Figma 3:4532, state V5) renders from GET /v1/users/{handle}
// for anyone, without a session.

function newHandle(): string {
  return `p-${randomUUID().slice(0, 8)}`;
}

// visitor is a page in a fresh browser context: no cookies, no session.
async function visitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test("a player's public profile opens without signing in after a solve", async ({ page, browser }) => {
  const email = await signInForTest(page);
  await solveDailyChallenge(page);
  const handle = newHandle();
  await setHandle(email, handle);

  const anonymous = await visitor(browser);
  await anonymous.goto(`/u/${handle}`);

  await expect(anonymous).toHaveTitle(`@${handle} · greenbuild`);
  await expect(anonymous.getByRole("heading", { level: 1 })).toHaveText(`@${handle}`);
  await expect(anonymous.getByText(/^Level \d+$/)).toBeVisible();
});

test("a hidden profile and an unknown handle get the same not-found page", async ({ page, browser }) => {
  const email = await signInForTest(page);
  const handle = newHandle();
  await setHandle(email, handle);
  await hideGameProfile(email);

  const anonymous = await visitor(browser);
  const hidden = await anonymous.goto(`/u/${handle}`);
  const hiddenPage = await anonymous.locator("main").innerText();
  const unknown = await anonymous.goto(`/u/${newHandle()}`);
  const unknownPage = await anonymous.locator("main").innerText();

  expect(hidden?.status()).toBe(404);
  expect(unknown?.status()).toBe(404);
  await expect(anonymous.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(hiddenPage).toBe(unknownPage);
});

import { expect, test } from "@playwright/test";
import { askForSignInLink, emailsTo, requestSignInLink, signInLinkTo } from "./mailpit";

// architecture.md, tasks 30a and 30c: an email link signs a player in, and the web app then calls the
// API as that player; task 50b: a deleted account signs in no more.
const NGINX_502 = "nginx-502-upstream";
const WRITE_HEADERS = { "x-greenbuild-request": "1" };

test("signs in with an email link, once", async ({ page }) => {
  const { email, link } = await requestSignInLink(page);
  await page.goto(link);
  const session = (await (await page.request.get("/api/auth/session")).json()) as { user?: { email?: string } };
  expect(session.user?.email).toBe(email);

  // The link is used up: following it again does not sign in.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/signin\?error=Verification/);
  await expect(page.getByText("expired or was already used")).toBeVisible();
});

test("calls the API as the signed-in player, and refuses a visitor without a session", async ({ page, browser }) => {
  await page.goto((await requestSignInLink(page)).link);
  const started = await page.request.post("/api/attempts", { headers: WRITE_HEADERS, data: { challenge_slug: NGINX_502 } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  expect((await page.request.get(`/api/attempts/${id}`)).status()).toBe(200);

  // A visitor without a session has no player to call the API as (task 30e).
  const visitor = await browser.newContext();
  expect((await visitor.request.get(`/api/attempts/${id}`)).status()).toBe(401);
  await visitor.close();

  expect((await page.request.post(`/api/attempts/${id}/abandon`, { headers: WRITE_HEADERS })).status()).toBe(200);
});

test("a visitor without a session is sent to sign in, and back to the page after", async ({ page }) => {
  await page.goto("/challenges");

  await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fchallenges$/);
  await expect(page.getByRole("heading", { name: "Sign in to greenbuild" })).toBeVisible();
});

test("a deleted player gets a link like anyone, and following it shows the account is closed", async ({ page }) => {
  const { email, link } = await requestSignInLink(page);
  await page.goto(link);
  expect((await page.request.delete("/api/me", { headers: WRITE_HEADERS })).status()).toBe(202);
  await page.context().clearCookies();

  await askForSignInLink(page, email);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect.poll(() => emailsTo(page.request, email)).toBe(2);
  await page.goto(await signInLinkTo(page.request, email));

  await expect(page).toHaveURL(/\/signin\?error=AccountClosed/);
  await expect(page.getByText("This account can no longer be used to sign in.")).toBeVisible();
  expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
});

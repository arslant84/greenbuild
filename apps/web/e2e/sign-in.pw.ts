import { expect, test } from "@playwright/test";
import { requestSignInLink } from "./mailpit";

// architecture.md, tasks 30a and 30c: an email link signs a player in, and the web app then calls the
// API as that player.
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

test("calls the API as the signed-in player, not as a dev session", async ({ page, browser }) => {
  await page.goto((await requestSignInLink(page)).link);
  const started = await page.request.post("/api/attempts", { headers: WRITE_HEADERS, data: { challenge_slug: NGINX_502 } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  expect((await page.request.get(`/api/attempts/${id}`)).status()).toBe(200);

  // A visitor with only a dev session is another user, so the attempt is not theirs.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/play");
  expect((await visitor.request.get(`/api/attempts/${id}`)).status()).toBe(404);
  await visitor.context().close();

  expect((await page.request.post(`/api/attempts/${id}/abandon`, { headers: WRITE_HEADERS })).status()).toBe(200);
});

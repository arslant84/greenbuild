import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// signInForTest signs a new player in through the test sign-in (task 30d; the stack runs with
// GREENBUILD_E2E_AUTH=1) and answers their email. The page's cookies then hold the session.
export async function signInForTest(page: Page): Promise<string> {
  const email = `player-${randomUUID()}@example.com`;
  const { csrfToken } = (await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  const signedIn = await page.request.post("/api/auth/callback/e2e", { form: { csrfToken, email, callbackUrl: "/" } });
  expect(signedIn.ok()).toBe(true);
  const session = (await (await page.request.get("/api/auth/session")).json()) as { user?: { email?: string } };
  expect(session.user?.email).toBe(email);
  return email;
}

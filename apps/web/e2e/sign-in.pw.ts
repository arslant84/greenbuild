import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, test } from "@playwright/test";

// architecture.md, task 30a: sign-in with an email link creates the user. The stack sends the link to
// Mailpit (infra/docker/play-stack.compose.yaml), whose API this test reads.
const MAILPIT_URL = process.env.PLAY_MAILPIT_URL ?? "http://127.0.0.1:18025";
const SIGN_IN_LINK = /https?:\/\/\S+\/api\/auth\/callback\/email\S+/;

interface MailpitSearch {
  messages: { ID: string }[];
}

async function signInLink(request: APIRequestContext, email: string): Promise<string> {
  let link: string | undefined;
  await expect(async () => {
    const search = (await (await request.get(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as MailpitSearch;
    const id = search.messages[0]?.ID;
    expect(id).toBeDefined();
    const message = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Subject: string; Text: string };
    expect(message.Subject).toBe("Sign in to greenbuild");
    link = SIGN_IN_LINK.exec(message.Text)?.[0];
    expect(link).toBeDefined();
  }).toPass();
  return link ?? "";
}

test("signs in with an email link, once", async ({ page }) => {
  const email = `player-${randomUUID()}@example.com`;
  await page.goto("/api/auth/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in with Email" }).click();
  await expect(page).toHaveURL(/\/api\/auth\/verify-request/);

  const link = await signInLink(page.request, email);
  await page.goto(link);
  const session = (await (await page.request.get("/api/auth/session")).json()) as { user?: { email?: string } };
  expect(session.user?.email).toBe(email);

  // The link is used up: following it again does not sign in.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/api\/auth\/error\?error=Verification/);
});

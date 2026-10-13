import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

// The local stack sends sign-in links to Mailpit (infra/docker/play-stack.compose.yaml), whose API
// the sign-in tests read.
const MAILPIT_URL = process.env.PLAY_MAILPIT_URL ?? "http://127.0.0.1:18025";
const SIGN_IN_LINK = /https?:\/\/\S+\/api\/auth\/callback\/email\S+/;

interface MailpitSearch {
  messages: { ID: string }[];
}

// signInLink waits for the sign-in email sent to email and answers its link.
export async function signInLink(request: APIRequestContext, email: string): Promise<string> {
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

// requestSignInLink asks Auth.js's sign-in page for a link for a new player and answers it.
export async function requestSignInLink(page: Page): Promise<{ email: string; link: string }> {
  const email = `player-${randomUUID()}@example.com`;
  await page.goto("/api/auth/signin");
  // The email-link form; with the test sign-in on, the page has a second email field.
  const form = page.locator("form", { has: page.getByRole("button", { name: "Sign in with Email" }) });
  await form.getByLabel("Email").fill(email);
  await form.getByRole("button", { name: "Sign in with Email" }).click();
  await expect(page).toHaveURL(/\/api\/auth\/verify-request/);
  return { email, link: await signInLink(page.request, email) };
}

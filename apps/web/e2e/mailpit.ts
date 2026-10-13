import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

// The local stack sends its emails to Mailpit (infra/docker/play-stack.compose.yaml), whose API these
// tests read.
const MAILPIT_URL = process.env.PLAY_MAILPIT_URL ?? "http://127.0.0.1:18025";
const SIGN_IN_LINK = /https?:\/\/\S+\/api\/auth\/callback\/email\S+/;

interface MailpitSearch {
  messages: { ID: string }[];
}

interface LinkEmail {
  to: string;
  subject: string;
  link: RegExp;
  // How long to wait for the email; the export job, for one, runs once a minute.
  timeout?: number;
}

// linkInEmail waits for the newest email to an address with that subject and answers the link in it.
export async function linkInEmail(request: APIRequestContext, { to, subject, link, timeout }: LinkEmail): Promise<string> {
  let found: string | undefined;
  await expect(async () => {
    const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
    const search = (await (await request.get(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as MailpitSearch;
    const id = search.messages[0]?.ID;
    expect(id).toBeDefined();
    const message = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Subject: string; Text: string };
    expect(message.Subject).toBe(subject);
    found = link.exec(message.Text)?.[0];
    expect(found).toBeDefined();
  }).toPass(timeout === undefined ? {} : { timeout });
  return found ?? "";
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
  return { email, link: await linkInEmail(page.request, { to: email, subject: "Sign in to greenbuild", link: SIGN_IN_LINK }) };
}

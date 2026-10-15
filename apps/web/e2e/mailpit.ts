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

// askForSignInLink fills the sign-in screen's email form (task 30b), ticking "I am 16 or older" unless
// told not to; the screen answers with "Check your email" or an error banner.
export async function askForSignInLink(page: Page, email: string, ageConfirmed = true): Promise<void> {
  await page.goto("/signin");
  if (ageConfirmed) {
    await page.getByLabel("I am 16 or older").check();
  }
  await page.getByLabel("Work or personal email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
}

// requestSignInLink asks the sign-in screen for a link for a new player who is 16 or older, and answers it.
export async function requestSignInLink(page: Page): Promise<{ email: string; link: string }> {
  const email = `player-${randomUUID()}@example.com`;
  await askForSignInLink(page, email);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  return { email, link: await signInLinkTo(page.request, email) };
}

export function signInLinkTo(request: APIRequestContext, email: string): Promise<string> {
  return linkInEmail(request, { to: email, subject: "Sign in to greenbuild", link: SIGN_IN_LINK });
}

// emailsTo counts the emails Mailpit holds for an address.
export async function emailsTo(request: APIRequestContext, email: string): Promise<number> {
  const query = encodeURIComponent(`to:"${email}"`);
  const search = (await (await request.get(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as MailpitSearch;
  return search.messages.length;
}

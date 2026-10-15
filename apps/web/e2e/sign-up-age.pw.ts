import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { askForSignInLink, emailsTo, requestSignInLink, signInLinkTo } from "./mailpit";
import { aPlayerCreatedBefore16Plus, signUpRecord } from "./play-db";

// architecture.md, tasks 30b and 31a: no account exists without the 16+ confirmation, and sign-up records
// the terms and privacy consents.
const SIGN_UP_CONSENTS = ["privacy", "terms"];

function anEmail(): string {
  return `player-${randomUUID()}@example.com`;
}

async function signedInEmail(page: Page): Promise<string | undefined> {
  const session = (await (await page.request.get("/api/auth/session")).json()) as { user?: { email?: string } } | null;
  return session?.user?.email;
}

test("a new player without the 16+ box is asked to tick it and gets no link", async ({ page }) => {
  const email = anEmail();

  await askForSignInLink(page, email, false);

  await expect(page.getByText("to create your account or continue to it")).toBeVisible();
  expect(await emailsTo(page.request, email)).toBe(0);
});

test("a link asked for with the box creates the account when opened in another browser", async ({ page, browser }) => {
  const { email, link } = await requestSignInLink(page);

  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(link);

  expect(await signedInEmail(phonePage)).toBe(email);
  expect(await signUpRecord(email)).toEqual({ ageConfirmed: true, consents: SIGN_UP_CONSENTS });
  await phone.close();
});

test("a player created before the 16+ rule confirms it at sign-in", async ({ page }) => {
  const email = anEmail();
  await aPlayerCreatedBefore16Plus(email);

  await askForSignInLink(page, email, false);
  await expect(page.getByText("to create your account or continue to it")).toBeVisible();

  await askForSignInLink(page, email);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await signInLinkTo(page.request, email));

  expect(await signedInEmail(page)).toBe(email);
  expect(await signUpRecord(email)).toEqual({ ageConfirmed: true, consents: SIGN_UP_CONSENTS });
});

test("a failed GitHub sign-in shows the frame's error", async ({ page }) => {
  await page.goto("/signin?error=OAuthCallbackError");

  await expect(page.getByText("Couldn't connect to GitHub")).toBeVisible();
});

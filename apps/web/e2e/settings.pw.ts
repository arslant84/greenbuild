import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { linkInEmail } from "./mailpit";
import { signInForTest } from "./test-player";

const EXPORT_LINK = /https?:\/\/\S+\/api\/me\/export\/[0-9a-f-]{36}/;
// The worker's export job runs once a minute.
const EXPORT_EMAIL_TIMEOUT_MS = 90_000;

// architecture.md, task 47b: the settings screen (Figma 7:10273) edits the player's profile through the API.
test("a changed display name is still there after a reload", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/settings");
  const name = `Player ${randomUUID().slice(0, 6)}`;

  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await page.getByLabel("Display Name").fill(name);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText(/Changes saved/);

  await page.reload();
  await expect(page.getByLabel("Display Name")).toHaveValue(name);
});

test("the catalog's Settings link opens the settings", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/challenges");
  await page.getByRole("link", { name: "Settings", exact: true }).first().click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Settings / Config")).toBeVisible();
});

test("the Account section shows the email and notifications stay off", async ({ page }) => {
  const email = await signInForTest(page);
  await page.goto("/settings");

  await expect(page.getByLabel("Primary email address")).toHaveValue(email);
  await expect(page.getByLabel("Weekly engineering digest")).toBeDisabled();
  await expect(page.getByLabel("Weekly engineering digest")).not.toBeChecked();
});

test("after a timezone change the next one shows when it unlocks", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/settings");
  const zone = page.getByLabel("Assigned Ledger Timezone");

  await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
  await zone.selectOption("Asia/Ashgabat");

  await expect(page.getByText("LOCKED", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next timezone change opens in 30 days \([A-Z][a-z]{2} \d{1,2}, \d{4}\)\./)).toBeVisible();
  await expect(zone).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Assigned Ledger Timezone")).toHaveValue("Asia/Ashgabat");
  await expect(page.getByText("LOCKED", { exact: true })).toBeVisible();
});

test("being found by companies needs the 18+ confirmation", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/settings");
  const toggle = page.getByLabel("Open to offers");

  await toggle.click({ force: true });
  await expect(page.getByText("Confirm you are 18 or older to be found by companies.")).toBeVisible();
  await expect(toggle).not.toBeChecked();

  await page.getByLabel(/I am 18 or older/).check();
  await toggle.click({ force: true });
  await expect(page.getByText("ACTIVE: VISIBLE TO VERIFIED COMPANIES")).toBeVisible();
  await expect(toggle).toBeChecked();
  // Leaving hidden grants the discovery consent, which the consent history lists.
  await expect(page.getByRole("list", { name: "Consent history" })).toContainText(/Company discovery.*Active/);
});

test("an export request shows the frame's notice and the link arrives by email", async ({ page }) => {
  const email = await signInForTest(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Request export (JSON)" }).click();
  const notice = page.getByRole("dialog", { name: "Data Export Initiated" });
  await expect(notice).toContainText(email);
  await expect(notice).toContainText("works for 7 days");
  await linkInEmail(page.request, { to: email, subject: "Your greenbuild data export", link: EXPORT_LINK, timeout: EXPORT_EMAIL_TIMEOUT_MS });
});

test("deleting the account needs the box and DELETE, then the settings are gone", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Delete account..." }).click();
  const confirm = page.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/I understand/).check();
  await page.getByPlaceholder("DELETE").fill("DELETE");
  await confirm.click();

  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await expect(page.getByText("Your settings could not be loaded.")).toBeVisible();
});

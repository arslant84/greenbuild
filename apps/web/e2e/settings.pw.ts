import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInForTest } from "./test-player";

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

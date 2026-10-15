import { PRIVACY_VERSION, TERMS_VERSION } from "@greenbuild/shared";
import { expect, test } from "@playwright/test";

// architecture.md, task 31a and deviation 30: the beta terms and privacy policy open for anyone, with the
// version sign-up records.
test("the beta terms and privacy policy open without signing in", async ({ browser }) => {
  const visitor = await browser.newContext();
  const page = await visitor.newPage();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await expect(page.getByText(`Version ${TERMS_VERSION}`)).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText(`Version ${PRIVACY_VERSION}`)).toBeVisible();
  await visitor.close();
});

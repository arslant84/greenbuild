import { expect, test } from "@playwright/test";
import { startChallenge } from "./daily-solve";
import { signInForTest } from "./test-player";

// architecture.md, task 35c: the hint button opens nginx-502's three hints one at a time; they stay after a
// reload, and once all are open the button says none are left.
test("opens the hints one at a time, keeps them after a reload, then shows none left", async ({ page }) => {
  await signInForTest(page);
  await startChallenge(page);
  const hintButton = page.getByRole("button", { name: /Get Diagnostic Hint/ });
  const hints = page.getByRole("region", { name: "Diagnostic hints" });

  await hintButton.click();
  await expect(hints).toContainText("A 502 comes from nginx");
  await expect(hintButton).toContainText("2/3 left");
  await expect(page.getByText("-20% applied")).toBeVisible();

  await page.reload();
  await expect(hints).toContainText("1 of 3 used");
  await expect(hints).toContainText("A 502 comes from nginx");

  await hintButton.click();
  await expect(hints).toContainText("2 of 3 used");
  await hintButton.click();
  await expect(hints).toContainText("Hint 3 · Recent");
  await expect(page.getByText("No hints left")).toBeVisible();
  await expect(page.getByText("-60% applied")).toHaveCount(0);
});

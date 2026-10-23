import { expect, test } from "@playwright/test";
import { startChallenge } from "./daily-solve";
import { signInForTest } from "./test-player";

// architecture.md, task 21b: a player who leaves a running attempt sees it on the Daily screen, resumes the
// same sandbox, or gives it up from there.
test("a player who leaves a running attempt resumes the same sandbox from the Daily screen", async ({ page }) => {
  await signInForTest(page);
  await startChallenge(page);
  const sandbox = page.url();

  await page.goto("/play");
  const running = page.getByRole("region", { name: "Attempt in progress" });
  await expect(running).toContainText("0/10 checks used");
  await expect(page.getByRole("button", { name: /Start Challenge/ })).toBeDisabled();
  await expect(page.getByText("Finish or give up your running attempt to start another.")).toBeVisible();

  await running.getByRole("link", { name: /Resume attempt/ }).click();
  await expect(page).toHaveURL(sandbox);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible();
});

test("giving up a running attempt from the Daily screen opens its debrief", async ({ page }) => {
  await signInForTest(page);
  await startChallenge(page);
  const sandbox = page.url();

  await page.goto("/play");
  await page.getByRole("region", { name: "Attempt in progress" }).getByRole("button", { name: "Give up" }).click();

  await expect(page).toHaveURL(`${sandbox}/result`);
  await page.goto("/play");
  await expect(page.getByRole("region", { name: "Attempt in progress" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Start Challenge/ })).toBeEnabled();
});

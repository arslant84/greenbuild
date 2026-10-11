import { expect, test } from "@playwright/test";

// architecture.md, task 41c: the Daily screen shows the challenge the worker published for today, not
// a hardcoded one. The play stack publishes nginx-502 on its first day (scripts/play-stack.sh).
test("the Daily screen shows today's published challenge", async ({ page }) => {
  await page.goto("/play");

  await expect(page.getByText("The site returns 502")).toBeVisible();
  await expect(page.getByText("sandbox-env // nginx-502-upstream")).toBeVisible();
  await expect(page.getByRole("button", { name: /Start Challenge/ })).toBeEnabled();
});

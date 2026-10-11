import { expect, type Page, test } from "@playwright/test";

// architecture.md, task 16: Start → wait for ready → terminal → Check → result, on the real stack.
// The fix is nginx-502's reference solution typed into the terminal, as a player would.
const FIX =
  '. /srv/app/app.env && sed -i "s#proxy_pass http://127.0.0.1:[0-9]*;#proxy_pass http://127.0.0.1:${PORT};#" /etc/nginx/conf.d/site.conf && nginx -s reload && sleep 1 && echo fixed-$((40+2))\n';
const SANDBOX_START_TIMEOUT_MS = 90_000;
const CHECK_TIMEOUT_MS = 60_000;
// The worker relays attempt.finished and credits XP and the streak within seconds of the solve.
const XP_TIMEOUT_MS = 30_000;

async function startChallenge(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: /Start today's challenge/ }).click();
  await page.getByRole("link", { name: /Let's go/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Start Challenge/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
}

async function check(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Check Solution/ }).click();
}

test("a player solves nginx-502 from the Daily screen to the debrief", async ({ page }) => {
  await startChallenge(page);

  await check(page);
  await expect(page.getByText(/Check failed:/)).toBeVisible({ timeout: CHECK_TIMEOUT_MS });
  await expect(page.getByText("9 checks remaining")).toBeVisible();

  await page.locator(".xterm").click();
  await page.keyboard.type(FIX);
  await expect(page.locator(".xterm-rows")).toContainText("fixed-42");

  await check(page);
  await expect(page.getByText(/INCIDENT RESOLVED IN/)).toBeVisible({ timeout: CHECK_TIMEOUT_MS });
  await expect(page.getByText("2/10 checks used")).toBeVisible();

  await page.getByRole("link", { name: /\/play\/.*\/result/ }).click();
  await expect(page.getByText("SOLVED", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1/2 checks passed")).toBeVisible();

  // Task 42b: the worker credits the solve, and the Daily status bar shows today's XP.
  await expect
    .poll(
      async () => {
        await page.goto("/play");
        return page.getByText(/XP TODAY/).textContent();
      },
      { timeout: XP_TIMEOUT_MS },
    )
    .not.toBe("+0 XP TODAY");

  // Task 44: the worker counts the solve, and the streak shows its first day.
  await expect
    .poll(
      async () => {
        await page.goto("/play");
        return page.getByText(/^Day d+$/).textContent();
      },
      { timeout: XP_TIMEOUT_MS },
    )
    .toBe("Day 1");
});

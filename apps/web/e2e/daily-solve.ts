import { expect, type Page } from "@playwright/test";

// The play stack's daily challenge is nginx-502; the fix is its reference solution typed into the
// terminal, as a player would.
export const FIX =
  '. /srv/app/app.env && sed -i "s#proxy_pass http://127.0.0.1:[0-9]*;#proxy_pass http://127.0.0.1:${PORT};#" /etc/nginx/conf.d/site.conf && nginx -s reload && sleep 1 && echo fixed-$((40+2))\n';
const SANDBOX_START_TIMEOUT_MS = 90_000;
export const CHECK_TIMEOUT_MS = 60_000;
const KEY_DELAY_MS = 5;

// startChallenge opens today's challenge from the landing and waits for its sandbox.
export async function startChallenge(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: /Start today's challenge/ }).click();
  await page.getByRole("link", { name: /Let's go/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Start Challenge/ }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByText("SANDBOX ACTIVE")).toBeVisible({ timeout: SANDBOX_START_TIMEOUT_MS });
}

export async function check(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Check Solution/ }).click();
}

// typeFix types the fix into the sandbox's terminal and waits until it has run. It waits for the shell's
// prompt first and types key by key with a short pause, as keys sent in a burst were seen lost.
export async function typeFix(page: Page): Promise<void> {
  await expect(page.locator(".xterm-rows")).toContainText("/ #");
  await page.locator(".xterm").click();
  await page.keyboard.type(FIX, { delay: KEY_DELAY_MS });
  await expect(page.locator(".xterm-rows")).toContainText("fixed-42");
}

// solveDailyChallenge starts today's challenge, fixes it and passes the check at the first try.
export async function solveDailyChallenge(page: Page): Promise<void> {
  await startChallenge(page);
  await typeFix(page);
  await check(page);
  await expect(page.getByText(/INCIDENT RESOLVED IN/)).toBeVisible({ timeout: CHECK_TIMEOUT_MS });
}

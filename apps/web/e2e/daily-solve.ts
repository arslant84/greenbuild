import { expect, type Page } from "@playwright/test";

// The play stack's daily challenge is nginx-502; the fix is its reference solution typed into the
// terminal, as a player would.
export const FIX =
  '. /srv/app/app.env && sed -i "s#proxy_pass http://127.0.0.1:[0-9]*;#proxy_pass http://127.0.0.1:${PORT};#" /etc/nginx/conf.d/site.conf && nginx -s reload && sleep 1 && echo fixed-$((40+2))\n';
const SANDBOX_START_TIMEOUT_MS = 90_000;
export const CHECK_TIMEOUT_MS = 60_000;
const KEY_DELAY_MS = 5;
// The probe's output differs from its input, so seeing it proves the shell ran the command.
const PROBE = "echo probe-$((20+1))\n";
const PROBE_TIMEOUT_MS = 2_000;
const TERMINAL_READY_TIMEOUT_MS = 30_000;

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

// typeFix types the fix into the sandbox's terminal and waits until it has run. Keys typed right after the
// terminal attaches can be lost even once the prompt shows, so a probe command goes first, typed again until
// its output appears; keys go one by one with a short pause.
export async function typeFix(page: Page): Promise<void> {
  await page.locator(".xterm").click();
  await expect(async () => {
    await page.keyboard.type(PROBE, { delay: KEY_DELAY_MS });
    await expect(page.locator(".xterm-rows")).toContainText("probe-21", { timeout: PROBE_TIMEOUT_MS });
  }).toPass({ timeout: TERMINAL_READY_TIMEOUT_MS });
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

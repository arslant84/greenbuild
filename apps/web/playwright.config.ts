import { defineConfig, devices } from "@playwright/test";

// The slice test runs against the stack from scripts/play-stack.sh (pnpm play:up).
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAY_WEB_URL ?? "http://localhost:3001",
    viewport: { width: 1280, height: 1024 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1024 } } }],
});

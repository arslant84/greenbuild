import { defineConfig } from "vitest/config";

// The worker's suites start PostgreSQL, Redis and Azurite containers. Stopping them can outlast
// Vitest's 10 s hook default while other packages' suites run their containers in parallel, which
// left containers behind and failed the run.
const CONTAINER_HOOK_TIMEOUT_MS = 60_000;

export default defineConfig({
  test: { hookTimeout: CONTAINER_HOOK_TIMEOUT_MS },
});

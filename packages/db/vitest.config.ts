import { defineConfig } from "vitest/config";

// Each suite starts a PostgreSQL container. Stopping it can outlast Vitest's 10 s hook default while
// other packages' suites run their containers in parallel, which failed the run.
const CONTAINER_HOOK_TIMEOUT_MS = 60_000;

export default defineConfig({
  test: { hookTimeout: CONTAINER_HOOK_TIMEOUT_MS },
});

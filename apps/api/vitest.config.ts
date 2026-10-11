import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS dependency injection needs decorator metadata, which Vitest's default transform does not emit.
// The e2e suites start PostgreSQL and Redis containers. Stopping them can outlast Vitest's 10 s hook
// default while other packages' suites run theirs in parallel, which failed runs.
const CONTAINER_HOOK_TIMEOUT_MS = 60_000;

export default defineConfig({
  plugins: [swc.vite()],
  test: { hookTimeout: CONTAINER_HOOK_TIMEOUT_MS },
});

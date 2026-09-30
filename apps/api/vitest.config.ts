import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS dependency injection needs decorator metadata, which Vitest's default transform does not emit.
export default defineConfig({
  plugins: [swc.vite()],
});

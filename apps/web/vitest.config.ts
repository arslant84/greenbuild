import { defineConfig } from "vitest/config";

// next-auth imports "next/server" without an extension, which Node's ESM loader refuses; vitest
// transforms it instead, as Next does when it bundles the app.
export default defineConfig({
  test: {
    server: { deps: { inline: ["next-auth"] } },
  },
});

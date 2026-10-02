import { defineConfig } from "drizzle-kit";

// Generating needs no database; migrations are SQL files reviewed in the PR and never edited later.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  strict: true,
});

export * from "./auth-adapter.js";
export * from "./client.js";
export * from "./config.js";
export * from "./schema/index.js";
export * from "./uuid.js";
export * from "./seed.js";
// Query operators come from here, so every app uses the same Drizzle as the schema.
export { and, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
export { applyMigrations } from "./migrate.js";

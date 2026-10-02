import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connect } from "./client.js";
import { loadDatabaseUrl } from "./config.js";

// The migrations folder ships next to dist/, so this works from the package and from a container image.
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

// applyMigrations brings a database to the latest schema; applied migrations are skipped.
export async function applyMigrations(url: string): Promise<void> {
  const connection = connect(url);
  try {
    await migrate(connection.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await connection.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await applyMigrations(loadDatabaseUrl());
  console.log("migrations applied");
}

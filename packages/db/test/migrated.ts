import { afterAll, beforeAll } from "vitest";
import { connect, type Database, type DatabaseConnection } from "../src/client.js";
import { applyMigrations } from "../src/migrate.js";
import { startPostgres, type TestDatabase } from "./postgres.js";

const STARTUP_TIMEOUT_MS = 120_000;

export interface MigratedDatabase {
  db: Database;
  url: string;
}

// useMigratedDatabase gives the surrounding describe block a fresh, migrated PostgreSQL 16.
export function useMigratedDatabase(): () => MigratedDatabase {
  let database: TestDatabase | undefined;
  let connection: DatabaseConnection | undefined;
  beforeAll(async () => {
    database = await startPostgres();
    await applyMigrations(database.url);
    connection = connect(database.url);
  }, STARTUP_TIMEOUT_MS);
  afterAll(async () => {
    await connection?.close();
    await database?.stop();
  });
  return () => {
    if (!connection || !database) {
      throw new Error("database not started");
    }
    return { db: connection.db, url: database.url };
  };
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

// connect opens a pool; call close on shutdown so pending queries finish.
export function connect(url: string): DatabaseConnection {
  const sql = postgres(url);
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "../uuid.js";

// Every table (architecture.md, data model): UUID v7 id, created_at and updated_at.
export function idColumn() {
  return uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());
}

export function timestampColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.js";

// Events written in the same transaction as the change they describe; the worker publishes them
// to Redis Streams and stamps published_at (architecture.md, data model: outbox).
export const outbox = pgTable(
  "outbox",
  {
    id: idColumn(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [index("outbox_unpublished").on(table.createdAt).where(sql`${table.publishedAt} is null`)],
);

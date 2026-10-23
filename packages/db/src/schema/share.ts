import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { attempts } from "./attempts.js";
import { idColumn, timestampColumns } from "./columns.js";
import { users } from "./users.js";

// A solved attempt's share card is public only through its token (task 51). One live token per attempt;
// revoking keeps the row, so a revoked link stays dead.
export const shareTokens = pgTable(
  "share_tokens",
  {
    id: idColumn(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("share_tokens_live_attempt").on(table.attemptId).where(sql`${table.revokedAt} is null`), index("share_tokens_user").on(table.userId)],
);

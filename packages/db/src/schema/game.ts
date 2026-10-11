import { index, integer, pgEnum, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { attempts } from "./attempts.js";
import { idColumn, timestampColumns } from "./columns.js";
import { users } from "./users.js";

export const xpReason = pgEnum("xp_reason", ["solve", "new_skills"]);

// xp_ledger is every XP award (task 42a); a player's XP is the sum. One row per attempt and reason,
// so a redelivered attempt.finished cannot award twice.
export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    reason: xpReason("reason").notNull(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "restrict" }),
    ...timestampColumns(),
  },
  (table) => [unique("xp_ledger_attempt_reason").on(table.attemptId, table.reason), index("xp_ledger_user").on(table.userId)],
);

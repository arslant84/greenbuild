import { REVIEW_DECISIONS } from "@greenbuild/shared";
import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { attempts } from "./attempts.js";
import { idColumn, timestampColumns } from "./columns.js";
import { users } from "./users.js";

// architecture.md, "Наказания" (task 49c): clear lifts the flag so the attempt is rated, void keeps it
// out of the rating for good, ban also bans the account.
export const reviewDecision = pgEnum("review_decision", REVIEW_DECISIONS);

// cheat_reviews is the one decision on a flagged attempt.
export const cheatReviews = pgTable("cheat_reviews", {
  id: idColumn(),
  attemptId: uuid("attempt_id")
    .notNull()
    .unique()
    .references(() => attempts.id, { onDelete: "restrict" }),
  decision: reviewDecision("decision").notNull(),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  note: text("note"),
  ...timestampColumns(),
});

// audit_log keeps every admin action (architecture.md, API rules: /v1/admin actions go to audit_log).
export const auditLog = pgTable(
  "audit_log",
  {
    id: idColumn(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: jsonb("details"),
    ...timestampColumns(),
  },
  (table) => [index("audit_log_target").on(table.targetType, table.targetId)],
);

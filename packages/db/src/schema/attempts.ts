import { ATTEMPT_MAX_CHECKS, SEED_MAX } from "@greenbuild/shared";
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgEnum, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { challengeVersions } from "./challenges.js";
import { idColumn, timestampColumns } from "./columns.js";

export const attemptContext = pgEnum("attempt_context", ["daily", "catalog", "assessment", "duel"]);
export const attemptStatus = pgEnum("attempt_status", ["starting", "ready", "solved", "failed", "expired", "abandoned"]);
export const sandboxStatus = pgEnum("sandbox_status", ["starting", "ready", "failed", "destroyed"]);

export const attempts = pgTable(
  "attempts",
  {
    id: idColumn(),
    // References users once that table exists.
    userId: uuid("user_id").notNull(),
    challengeVersionId: uuid("challenge_version_id")
      .notNull()
      .references(() => challengeVersions.id, { onDelete: "restrict" }),
    seed: bigint("seed", { mode: "number" }).notNull(),
    context: attemptContext("context").notNull(),
    // References assessment_invites once that table exists (Stage 1.5).
    assessmentInviteId: uuid("assessment_invite_id"),
    status: attemptStatus("status").notNull().default("starting"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    checksUsed: smallint("checks_used").notNull().default(0),
    hintsUsed: smallint("hints_used").notNull().default(0),
    score: integer("score"),
    flagged: boolean("flagged").notNull().default(false),
    ...timestampColumns(),
  },
  (table) => [
    index("attempts_user_created").on(table.userId, table.createdAt),
    check("attempts_seed_range", sql`${table.seed} between 0 and ${sql.raw(String(SEED_MAX))}`),
    check("attempts_checks_range", sql`${table.checksUsed} between 0 and ${sql.raw(String(ATTEMPT_MAX_CHECKS))}`),
    check("attempts_hints_not_negative", sql`${table.hintsUsed} >= 0`),
  ],
);

export const sandboxSessions = pgTable(
  "sandbox_sessions",
  {
    id: idColumn(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "restrict" }),
    node: text("node"),
    podName: text("pod_name"),
    status: sandboxStatus("status").notNull().default("starting"),
    destroyedAt: timestamp("destroyed_at", { withTimezone: true }),
    exitReason: text("exit_reason"),
    // Blob name of the session log; log_deleted_at is set when the 90-day rule removes it.
    logRef: text("log_ref"),
    logDeletedAt: timestamp("log_deleted_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [index("sandbox_sessions_attempt").on(table.attemptId)],
);

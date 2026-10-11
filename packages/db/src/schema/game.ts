import { GLICKO_INITIAL_RATING, GLICKO_INITIAL_RATING_DEVIATION, GLICKO_INITIAL_VOLATILITY } from "@greenbuild/shared";
import { date, index, integer, pgEnum, pgTable, real, text, unique, uuid } from "drizzle-orm/pg-core";
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

// user_skills is a player's Glicko-2 rating per skill (task 43b), keyed by the manifest's skill slug
// (e.g. linux); a skills table with names and a tree comes when a screen needs them.
export const userSkills = pgTable(
  "user_skills",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    skill: text("skill").notNull(),
    rating: real("rating").notNull().default(GLICKO_INITIAL_RATING),
    ratingDeviation: real("rating_deviation").notNull().default(GLICKO_INITIAL_RATING_DEVIATION),
    volatility: real("volatility").notNull().default(GLICKO_INITIAL_VOLATILITY),
    attemptsCount: integer("attempts_count").notNull().default(0),
    ...timestampColumns(),
  },
  (table) => [unique("user_skills_user_skill").on(table.userId, table.skill)],
);

// streaks is one row per player (task 44): the worker applies each solve with shared applySolve.
export const streaks = pgTable("streaks", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  // The player's calendar day (their timezone) of the last solve that counted.
  lastDay: date("last_day", { mode: "string" }),
  freezesAvailable: integer("freezes_available").notNull().default(0),
  ...timestampColumns(),
});

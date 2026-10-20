import { CONSENT_KINDS, DEFAULT_REMINDER_HOUR, DISCOVERY_MODES, REVEALED_FIELDS } from "@greenbuild/shared";
import { sql } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.js";
import { users } from "./users.js";

// architecture.md, privacy by default: a player is invisible to companies until they choose otherwise.
export const discoveryMode = pgEnum("discovery_mode", DISCOVERY_MODES);
export const revealedField = pgEnum("revealed_field", REVEALED_FIELDS);
export const consentKind = pgEnum("consent_kind", CONSENT_KINDS);
export const privacyRequestKind = pgEnum("privacy_request_kind", ["export", "delete", "correct"]);
export const privacyRequestStatus = pgEnum("privacy_request_status", ["pending", "processing", "completed", "rejected"]);

export const userSettings = pgTable("user_settings", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  discoveryMode: discoveryMode("discovery_mode").notNull().default("hidden"),
  // Separate from discovery: a public game profile does not make a player findable by companies.
  gameProfilePublic: boolean("game_profile_public").notNull().default(true),
  // Fields a player shares with a company that contacts them; nothing until they choose.
  revealedFields: revealedField("revealed_fields")
    .array()
    .notNull()
    .default(sql`'{}'`),
  // Reminders are opt-in.
  notifyEmail: boolean("notify_email").notNull().default(false),
  notifyPush: boolean("notify_push").notNull().default(false),
  // The local hour the streak reminder goes at (task 52), and the local day it last went, so it goes once.
  reminderHour: smallint("reminder_hour").notNull().default(DEFAULT_REMINDER_HOUR),
  lastRemindedDay: date("last_reminded_day"),
  ...timestampColumns(),
});

// One row per consent to a document version; revoking sets revoked_at, so the history is kept.
export const consents = pgTable(
  "consents",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: consentKind("kind").notNull(),
    version: text("version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [index("consents_user").on(table.userId)],
);

// Data subject requests (GDPR, CCPA), answered within 30 days.
export const privacyRequests = pgTable(
  "privacy_requests",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: privacyRequestKind("kind").notNull(),
    status: privacyRequestStatus("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Blob name of an export archive.
    artifactRef: text("artifact_ref"),
    ...timestampColumns(),
  },
  (table) => [index("privacy_requests_user").on(table.userId)],
);

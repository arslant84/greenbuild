import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.js";

export const userRole = pgEnum("user_role", ["player", "admin"]);
// architecture.md, anti-cheat penalties: systematic cheating bans the account; deletion hides it first.
export const userStatus = pgEnum("user_status", ["active", "banned", "deleted"]);
export const authProvider = pgEnum("auth_provider", ["github", "google", "email"]);

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    // Chosen by the player after sign-in (task 32), so empty until then; stored lowercase so the
    // unique constraint is case-insensitive.
    handle: text("handle").unique(),
    displayName: text("display_name"),
    // Lowercase for the same reason; a GitHub account may not share an email.
    email: text("email").unique(),
    avatarUrl: text("avatar_url"),
    // ISO 3166-1 alpha-2; only a filter companies switch on, never part of the rating.
    country: text("country"),
    timezone: text("timezone").notNull().default("UTC"),
    // The timezone may change once in 30 days (task 32), so a day cannot be won by switching zones.
    timezoneChangedAt: timestamp("timezone_changed_at", { withTimezone: true }),
    locale: text("locale").notNull().default("en"),
    role: userRole("role").notNull().default("player"),
    status: userStatus("status").notNull().default("active"),
    // The 16+ checkbox at sign-up (task 30b); no birth date is stored. 18+ is confirmed when search is switched on.
    ageConfirmed16At: timestamp("age_confirmed_16_at", { withTimezone: true }),
    ageConfirmed18At: timestamp("age_confirmed_18_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [
    check("users_handle_lowercase", sql`${table.handle} = lower(${table.handle})`),
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check("users_country_iso2", sql`${table.country} ~ '^[A-Z]{2}$'`),
  ],
);

// One row per way of signing in; a user may link several.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    ...timestampColumns(),
  },
  (table) => [unique("auth_accounts_provider_user").on(table.provider, table.providerUserId), index("auth_accounts_user").on(table.userId)],
);

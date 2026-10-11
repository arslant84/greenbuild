import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { attempts } from "./attempts.js";
import { challengeVersions } from "./challenges.js";
import { idColumn, timestampColumns } from "./columns.js";
import { users } from "./users.js";

// architecture.md, "Компании: минимум для этапа 1.5": the tables exist before the company screens
// (task 31b); columns are added by the features that need them.
export const companyStatus = pgEnum("company_status", ["pending", "verified", "suspended"]);
export const companyRole = pgEnum("company_role", ["owner", "recruiter", "viewer"]);

export const companies = pgTable(
  "companies",
  {
    id: idColumn(),
    name: text("name").notNull(),
    // The company's email domain, verified before it can search or invite; lowercase.
    domain: text("domain").notNull().unique(),
    status: companyStatus("status").notNull().default("pending"),
    stripeCustomerId: text("stripe_customer_id").unique(),
    ...timestampColumns(),
  },
  (table) => [check("companies_domain_lowercase", sql`${table.domain} = lower(${table.domain})`)],
);

export const companyMembers = pgTable(
  "company_members",
  {
    id: idColumn(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: companyRole("role").notNull(),
    ...timestampColumns(),
  },
  (table) => [unique("company_members_company_user").on(table.companyId, table.userId), index("company_members_user").on(table.userId)],
);

// Invitation links carry a random token; only its hash is stored, so a database leak opens nothing.
export const companyInvitations = pgTable(
  "company_invitations",
  {
    id: idColumn(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: companyRole("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [check("company_invitations_email_lowercase", sql`${table.email} = lower(${table.email})`)],
);

export const assessmentInvites = pgTable(
  "assessment_invites",
  {
    id: idColumn(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    challengeVersionId: uuid("challenge_version_id")
      .notNull()
      .references(() => challengeVersions.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Set when the candidate starts; one attempt per invite.
    attemptId: uuid("attempt_id")
      .unique()
      .references(() => attempts.id, { onDelete: "restrict" }),
    ...timestampColumns(),
  },
  (table) => [
    check("assessment_invites_email_lowercase", sql`${table.email} = lower(${table.email})`),
    index("assessment_invites_company").on(table.companyId),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  id: idColumn(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "restrict" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  // Plans and Stripe's statuses are defined by Stripe Billing (Stage 1.5); kept as text until then.
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  ...timestampColumns(),
});

import { GLICKO_INITIAL_RATING, GLICKO_INITIAL_RATING_DEVIATION } from "@greenbuild/shared";
import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, real, smallint, text, unique, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampColumns } from "./columns.js";

export const challengeStatus = pgEnum("challenge_status", ["draft", "review", "live", "retired"]);
export const challengeVisibility = pgEnum("challenge_visibility", ["public", "company_private"]);
export const challengeSource = pgEnum("challenge_source", ["human", "ai", "community", "company"]);

export const challenges = pgTable(
  "challenges",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    difficulty: smallint("difficulty").notNull(),
    status: challengeStatus("status").notNull().default("draft"),
    visibility: challengeVisibility("visibility").notNull().default("public"),
    // References companies once that table exists (Stage 1.5).
    companyId: uuid("company_id"),
    ...timestampColumns(),
  },
  (table) => [
    check("challenges_difficulty_range", sql`${table.difficulty} between 1 and 10`),
    check("challenges_private_has_company", sql`${table.visibility} = 'public' or ${table.companyId} is not null`),
  ],
);

// Versions are immutable once published: a fix is a new version, and old attempts keep theirs.
export const challengeVersions = pgTable(
  "challenge_versions",
  {
    id: idColumn(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    specJson: jsonb("spec_json").notNull(),
    imageRef: text("image_ref").notNull(),
    // Written by the challenge pipeline after the image is pushed to the registry.
    imageDigest: text("image_digest"),
    checkerHash: text("checker_hash").notNull(),
    // hints.md, weakest first. Null only for versions published before hints were stored; the seed fills them.
    hintsJson: jsonb("hints_json").$type<string[]>(),
    rating: real("rating").notNull().default(GLICKO_INITIAL_RATING),
    ratingDeviation: real("rating_deviation").notNull().default(GLICKO_INITIAL_RATING_DEVIATION),
    solveRateBaseline: real("solve_rate_baseline"),
    retiredReason: text("retired_reason"),
    source: challengeSource("source").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    unique("challenge_versions_challenge_version").on(table.challengeId, table.version),
    check("challenge_versions_version_positive", sql`${table.version} >= 1`),
  ],
);

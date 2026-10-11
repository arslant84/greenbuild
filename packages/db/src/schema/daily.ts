import { DAILY_TRACKS } from "@greenbuild/shared";
import { date, pgEnum, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { challengeVersions } from "./challenges.js";
import { idColumn, timestampColumns } from "./columns.js";

export const dailyTrack = pgEnum("daily_track", DAILY_TRACKS);

// One daily challenge per UTC day and track (task 41a); the unique pair makes publishing idempotent.
export const dailyChallenges = pgTable(
  "daily_challenges",
  {
    id: idColumn(),
    day: date("day", { mode: "string" }).notNull(),
    track: dailyTrack("track").notNull(),
    challengeVersionId: uuid("challenge_version_id")
      .notNull()
      .references(() => challengeVersions.id, { onDelete: "restrict" }),
    ...timestampColumns(),
  },
  (table) => [unique("daily_challenges_day_track").on(table.day, table.track)],
);

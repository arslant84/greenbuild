import { z } from "zod";
import { DAILY_TRACKS } from "../constants/index.js";
import { ATTEMPT_STATUSES } from "./attempts.js";
import { challengeCardSchema } from "./challenges.js";

// GET /v1/daily?track=: today's challenge (UTC) for a track; linux is the only track for now.
export const dailyQuerySchema = z.strictObject({ track: z.enum(DAILY_TRACKS).default("linux") });

export const dailyResponseSchema = z.object({
  day: z.iso.date(),
  track: z.enum(DAILY_TRACKS),
  challenge: challengeCardSchema,
  // The player's newest attempt at it started today, or null when they have not started.
  attempt: z.object({ id: z.uuid(), status: z.enum(ATTEMPT_STATUSES) }).nullable(),
});

// utcDay is the YYYY-MM-DD of a moment in UTC, the calendar the daily challenge follows.
export function utcDay(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

export type DailyQuery = z.infer<typeof dailyQuerySchema>;
export type DailyResponse = z.infer<typeof dailyResponseSchema>;

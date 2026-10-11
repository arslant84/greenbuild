import { z } from "zod";
import { DAILY_TRACKS, MAX_PAGE_LIMIT } from "../constants/index.js";

export const LEADERBOARD_KINDS = ["weekly", "skill", "daily"] as const;
const DEFAULT_LIMIT = 50;

// GET /v1/leaderboards/{kind} (task 45b): weekly XP (optionally one country), a skill's rating, or
// today's daily challenge by solve time.
export const leaderboardQuerySchema = z
  .strictObject({
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    skill: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
    track: z.enum(DAILY_TRACKS).default("linux"),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_LIMIT),
  });

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  // Null for a player without a handle or whose game profile is not public.
  handle: z.string().nullable(),
  display_name: z.string().nullable(),
  // XP for weekly, the rating for skill, milliseconds for daily (lower ranks higher).
  score: z.number(),
});

export const leaderboardResponseSchema = z.object({
  kind: z.enum(LEADERBOARD_KINDS),
  entries: z.array(leaderboardEntrySchema),
  // The signed-in player's place, or null when they are not on the board.
  me: z.object({ rank: z.number().int().positive(), score: z.number() }).nullable(),
});

export type LeaderboardKind = (typeof LEADERBOARD_KINDS)[number];
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

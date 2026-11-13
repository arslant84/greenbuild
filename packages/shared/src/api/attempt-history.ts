import { z } from "zod";
import { FINISHED_ATTEMPT_STATUSES } from "../queue/index.js";

// GET /v1/me/attempts: the player's finished attempts, newest first, for the Daily screen's history blocks.

export const ATTEMPT_CONTEXTS = ["daily", "catalog", "assessment", "duel"] as const;

const HISTORY_DEFAULT = 20;
// The most attempts one request answers; the history screen asks for all of them.
export const HISTORY_MAX = 50;

export const attemptHistoryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(HISTORY_MAX).default(HISTORY_DEFAULT),
});

export const attemptHistoryItemSchema = z.object({
  id: z.uuid(),
  challenge_slug: z.string(),
  challenge_title: z.string(),
  // A daily attempt is for the challenge of the UTC day it was created on.
  context: z.enum(ATTEMPT_CONTEXTS),
  status: z.enum(FINISHED_ATTEMPT_STATUSES),
  created_at: z.iso.datetime(),
  finished_at: z.iso.datetime().nullable(),
  // From the sandbox being ready to the end; null for an attempt that ended before it was ready.
  duration_ms: z.number().int().nonnegative().nullable(),
  hints_used: z.number().int().nonnegative(),
  // XP the worker credited for the attempt; 0 until it has, and for an attempt that earned none.
  xp_earned: z.number().int().nonnegative(),
});

export const attemptHistoryResponseSchema = z.object({ attempts: z.array(attemptHistoryItemSchema) });

export type AttemptHistoryQuery = z.infer<typeof attemptHistoryQuerySchema>;
export type AttemptHistoryItem = z.infer<typeof attemptHistoryItemSchema>;
export type AttemptHistoryResponse = z.infer<typeof attemptHistoryResponseSchema>;

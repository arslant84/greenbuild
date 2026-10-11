import { z } from "zod";

// Contract of /v1/attempts, shared by the API and the web app.

export const ATTEMPT_STATUSES = ["starting", "ready", "solved", "failed", "expired", "abandoned"] as const;

export const startAttemptRequestSchema = z.strictObject({
  challenge_slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
});

export const attemptResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(ATTEMPT_STATUSES),
  challenge_slug: z.string(),
  created_at: z.iso.datetime(),
  // When the sandbox became ready; the time limit counts from here.
  started_at: z.iso.datetime().nullable(),
  checks_used: z.number().int().nonnegative(),
  // Present while the sandbox is ready: valid for 60 seconds, only for connecting the terminal.
  attach_token: z.string().optional(),
});

export type StartAttemptRequest = z.infer<typeof startAttemptRequestSchema>;
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;

// details of the 409 a start gets while another attempt of the player is still active
export const activeAttemptConflictSchema = z.object({ active_attempt_id: z.uuid() });

// GET /v1/attempts?status=active: the player's running attempt; at most one, so no pagination.
export const listAttemptsQuerySchema = z.strictObject({ status: z.literal("active") });
export const attemptListResponseSchema = z.object({ attempts: z.array(attemptResponseSchema).max(1) });

export type AttemptListResponse = z.infer<typeof attemptListResponseSchema>;

// POST /v1/attempts/{id}/check
export const checkResponseSchema = z.object({
  passed: z.boolean(),
  output_tail: z.string(),
  duration_ms: z.number().int().nonnegative(),
  checks_left: z.number().int().nonnegative(),
});

// GET /v1/attempts/{id}/result; XP, rating and the write-up join it in Stage 2.
export const attemptResultSchema = z.object({
  id: z.uuid(),
  status: z.enum(ATTEMPT_STATUSES),
  challenge_slug: z.string(),
  checks_used: z.number().int().nonnegative(),
  // From the sandbox being ready to the passing check.
  duration_ms: z.number().int().nonnegative().nullable(),
  finished_at: z.iso.datetime().nullable(),
  // XP the attempt earned; null until the worker credits it (task 42b), and for an attempt not solved.
  xp_earned: z.number().int().nonnegative().nullable(),
  checks: z.array(
    z.object({ passed: z.boolean(), output_tail: z.string(), duration_ms: z.number().int().nonnegative(), checked_at: z.iso.datetime() }),
  ),
});

export type CheckResponse = z.infer<typeof checkResponseSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;

// POST /v1/attempts/{id}/hint: the next hint, weakest first; number counts from 1.
export const hintResponseSchema = z.object({
  hint: z.string(),
  number: z.number().int().positive(),
  hints_left: z.number().int().nonnegative(),
});

export type HintResponse = z.infer<typeof hintResponseSchema>;

import { z } from "zod";
import { ATTEMPT_STATUSES } from "./attempts.js";

export const REVIEW_DECISIONS = ["clear", "void", "ban"] as const;
const NOTE_MAX = 1_000;

// GET /v1/admin/reviews (task 49c): flagged attempts waiting for a decision, oldest first.
export const reviewQueueSchema = z.object({
  attempts: z.array(
    z.object({
      attempt_id: z.uuid(),
      user_id: z.uuid(),
      handle: z.string().nullable(),
      challenge_slug: z.string(),
      status: z.enum(ATTEMPT_STATUSES),
      finished_at: z.iso.datetime().nullable(),
      signals: z.array(z.object({ signal: z.string(), value: z.number(), weight: z.number().int() })),
    }),
  ),
});

// POST /v1/admin/reviews/{attempt_id}: the one decision on a flagged attempt.
export const reviewRequestSchema = z.strictObject({
  decision: z.enum(REVIEW_DECISIONS),
  note: z.string().trim().min(1).max(NOTE_MAX).optional(),
});

export const reviewResponseSchema = z.object({ attempt_id: z.uuid(), decision: z.enum(REVIEW_DECISIONS) });

export type ReviewQueue = z.infer<typeof reviewQueueSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

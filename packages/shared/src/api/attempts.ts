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
  // Present while the sandbox is ready: valid for 60 seconds, only for connecting the terminal.
  attach_token: z.string().optional(),
});

export type StartAttemptRequest = z.infer<typeof startAttemptRequestSchema>;
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;

import { z } from "zod";

// Share cards (task 51): a solved attempt's result, public only through its token.

// 16 random bytes, base64url: unguessable, and short enough for a link.
export const SHARE_TOKEN_BYTES = 16;
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

// POST /v1/attempts/{id}/share: the attempt's live token, made on first use.
export const shareCreatedSchema = z.object({ token: shareTokenSchema });

// GET /v1/share/{token} (public): what the card shows. Nothing that identifies the attempt or its seed.
export const shareCardSchema = z.object({
  display_name: z.string().nullable(),
  handle: z.string().nullable(),
  challenge_title: z.string(),
  skills: z.array(z.string()),
  duration_ms: z.number().int().nonnegative().nullable(),
  // Null until the worker credits the solve.
  xp_earned: z.number().int().nonnegative().nullable(),
  checks_passed: z.number().int().nonnegative(),
  checks_used: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  solved_at: z.iso.datetime(),
});

export type ShareCreated = z.infer<typeof shareCreatedSchema>;
export type ShareCard = z.infer<typeof shareCardSchema>;

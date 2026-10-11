import { z } from "zod";

// About 95% of a player's true skill lies within rating ± 1.96 × rating deviation (Glicko-2).
export const RATING_CONFIDENCE_Z = 1.96;

// GET /v1/users/{handle} (task 46a): a player's public game profile, while they keep it public.
export const publicProfileSchema = z.object({
  handle: z.string(),
  display_name: z.string().nullable(),
  level: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  solved: z.number().int().nonnegative(),
  streak: z.object({ current: z.number().int().nonnegative(), longest: z.number().int().nonnegative() }),
  // Strongest first; the interval is where the true rating lies with about 95% confidence.
  skills: z.array(
    z.object({
      skill: z.string(),
      rating: z.number().int(),
      interval: z.tuple([z.number().int(), z.number().int()]),
      attempts: z.number().int().nonnegative(),
    }),
  ),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

import { z } from "zod";

// GET /v1/challenges/{slug}: what the player sees before and during an attempt.
export const challengeCardSchema = z.object({
  slug: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  statement: z.string(),
  difficulty: z.number().int().min(1).max(10),
  skills: z.array(z.string()),
  time_limit_sec: z.number().int().positive(),
});

export type ChallengeCard = z.infer<typeof challengeCardSchema>;

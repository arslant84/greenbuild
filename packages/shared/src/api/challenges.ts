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

export const CATALOG_PAGE_DEFAULT = 9;
export const CATALOG_PAGE_MAX = 50;
const difficultySchema = z.coerce.number().int().min(1).max(10);

// GET /v1/challenges: live public challenges, newest first. `cursor` is the previous page's next_cursor.
export const challengeListQuerySchema = z
  .object({
    skill: z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/).optional(),
    difficulty_min: difficultySchema.optional(),
    difficulty_max: difficultySchema.optional(),
    limit: z.coerce.number().int().min(1).max(CATALOG_PAGE_MAX).default(CATALOG_PAGE_DEFAULT),
    cursor: z.uuid().optional(),
  })
  .refine((query) => (query.difficulty_min ?? 1) <= (query.difficulty_max ?? 10), "difficulty_min must not exceed difficulty_max");

export type ChallengeListQuery = z.infer<typeof challengeListQuerySchema>;

export const challengeListSchema = z.object({
  challenges: z.array(challengeCardSchema),
  next_cursor: z.uuid().nullable(),
});

export type ChallengeList = z.infer<typeof challengeListSchema>;

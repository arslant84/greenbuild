import { z } from "zod";
import { challengeCardSchema } from "./challenges.js";

export const CATALOG_PAGE_DEFAULT = 9;
export const CATALOG_PAGE_MAX = 50;
const CATALOG_FILTER_VALUES_MAX = 20;

// Time-limit windows of the catalog's "SLA window" filter, in seconds: [from, to], both inclusive.
export const CATALOG_SLA_WINDOWS = {
  lt5: [0, 299],
  "5to10": [300, 600],
  "10to15": [601, 900],
  "15plus": [901, Number.MAX_SAFE_INTEGER],
} as const;
export type CatalogSlaWindow = keyof typeof CATALOG_SLA_WINDOWS;

export const CATALOG_PROGRESS_STATUSES = ["solved", "failed", "in_progress"] as const;
export const CATALOG_STATUS_FILTERS = ["unsolved", "solved", "failed", "flagged"] as const;

const difficultySchema = z.coerce.number().int().min(1).max(10);
// A filter given once arrives as a string, given several times as an array.
const manyOf = <Item extends z.ZodType>(item: Item) =>
  z.preprocess((value) => (value === undefined ? undefined : [value].flat()), z.array(item).min(1).max(CATALOG_FILTER_VALUES_MAX).optional());

// GET /v1/challenges: live public challenges, newest first. Several skills or SLA windows match any of
// them; `cursor` is the previous page's next_cursor.
export const challengeListQuerySchema = z
  .object({
    skill: manyOf(z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/)),
    sla: manyOf(z.enum(Object.keys(CATALOG_SLA_WINDOWS) as [CatalogSlaWindow, ...CatalogSlaWindow[]])),
    status: z.enum(CATALOG_STATUS_FILTERS).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    difficulty_min: difficultySchema.optional(),
    difficulty_max: difficultySchema.optional(),
    limit: z.coerce.number().int().min(1).max(CATALOG_PAGE_MAX).default(CATALOG_PAGE_DEFAULT),
    cursor: z.uuid().optional(),
  })
  .refine((query) => (query.difficulty_min ?? 1) <= (query.difficulty_max ?? 10), "difficulty_min must not exceed difficulty_max");

export type ChallengeListQuery = z.infer<typeof challengeListQuerySchema>;

// The player's own history with a challenge: in progress wins over solved, solved over failed.
export const catalogProgressSchema = z.object({
  status: z.enum(CATALOG_PROGRESS_STATUSES).nullable(),
  finished_attempts: z.number().int().nonnegative(),
  best_solve_ms: z.number().int().nonnegative().nullable(),
  active_attempt_id: z.uuid().nullable(),
  // The newest finished attempt, whose result the card's Review opens.
  last_finished_attempt_id: z.uuid().nullable(),
});

export const catalogEntrySchema = challengeCardSchema.extend({ progress: catalogProgressSchema });

export const challengeListSchema = z.object({
  challenges: z.array(catalogEntrySchema),
  next_cursor: z.uuid().nullable(),
  // Challenges matching the filters, across all pages.
  total: z.number().int().nonnegative(),
  // Over the whole catalog, whatever the filters: what the header and the filter counts show.
  catalog: z.object({
    challenges: z.number().int().nonnegative(),
    solved: z.number().int().nonnegative(),
    skills: z.record(z.string(), z.number().int().nonnegative()),
  }),
});

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type ChallengeList = z.infer<typeof challengeListSchema>;

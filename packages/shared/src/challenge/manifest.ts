import { z } from "zod";
import { CHALLENGE_DIFFICULTY_MAX, CHALLENGE_HINTS_MAX } from "../constants/index.js";
import { SANDBOX_CAPABILITIES } from "../queue/index.js";

// challenge.yaml, as architecture.md "Challenge specification" describes it. Strict objects, so a
// misspelt key fails validation instead of being ignored. Limits match sandbox.create's.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const RANDOMIZE_KEY = /^[a-z][a-z0-9_]*$/;
const CPU = /^(\d+m|\d+(\.\d+)?)$/;
const QUANTITY = /^\d+(Mi|Gi)$/;
const CHECK_DIR = "/opt/greenbuild/";
const TITLE_MAX_LENGTH = 80;
const STATEMENT_MAX_LENGTH = 500;
const TIME_LIMIT_MIN_SEC = 60;
const TIME_LIMIT_MAX_SEC = 7_200;
const CHECK_TIMEOUT_MAX_SEC = 60;
// Skill weights are shares of one challenge, so they add up to 1 within rounding.
const SKILL_WEIGHT_TOLERANCE = 0.001;

export const CHALLENGE_SOURCES = ["human", "ai", "community", "company"] as const;

const skillsSchema = z
  .record(z.string().regex(SKILL), z.number().gt(0).max(1))
  .refine((skills) => Object.keys(skills).length > 0, "at least one skill is needed")
  .refine((skills) => Math.abs(sum(Object.values(skills)) - 1) <= SKILL_WEIGHT_TOLERANCE, "skill weights must add up to 1");

const randomizeValueSchema = z.union([
  z.strictObject({ range: z.tuple([z.number().int(), z.number().int()]) }).refine(({ range }) => range[0] <= range[1], "range must be [min, max]"),
  z.strictObject({ pick: z.array(z.string().min(1)).min(2) }),
]);

export const challengeManifestSchema = z.strictObject({
  id: z.string().regex(SLUG),
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  statement: z.string().trim().min(1).max(STATEMENT_MAX_LENGTH),
  difficulty: z.number().int().min(1).max(CHALLENGE_DIFFICULTY_MAX),
  skills: skillsSchema,
  time_limit_sec: z.number().int().min(TIME_LIMIT_MIN_SEC).max(TIME_LIMIT_MAX_SEC),
  resources: z.strictObject({ cpu: z.string().regex(CPU), memory: z.string().regex(QUANTITY), disk: z.string().regex(QUANTITY) }),
  // Only none until a challenge needs the allowlist network.
  network: z.literal("none"),
  capabilities: z
    .array(z.enum(SANDBOX_CAPABILITIES))
    .refine((items) => new Set(items).size === items.length, "capabilities must not repeat")
    .default([]),
  randomize: z.record(z.string().regex(RANDOMIZE_KEY), randomizeValueSchema).default({}),
  check: z.strictObject({
    command: z.string().startsWith(CHECK_DIR),
    timeout_sec: z.number().int().min(1).max(CHECK_TIMEOUT_MAX_SEC),
    run_as: z.literal("root"),
  }),
  hints: z.number().int().min(0).max(CHALLENGE_HINTS_MAX),
  source: z.enum(CHALLENGE_SOURCES),
});

export type ChallengeManifest = z.infer<typeof challengeManifestSchema>;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

import { z } from "zod";
import { ATTEMPT_MAX_CHECKS, SEED_MAX } from "../constants/index.js";

// TypeScript side of the queue contracts. The JSON Schemas in packages/queue/schemas are the
// source of truth; queue.test.ts fails when these drift from them.

export const STREAM_SANDBOX_CREATE = "sandbox.create";
export const STREAM_SANDBOX_STATUS = "sandbox.status";
export const STREAM_SANDBOX_DESTROY = "sandbox.destroy";
export const STREAM_ATTEMPT_FINISHED = "attempt.finished";
export const QUEUE_PAYLOAD_FIELD = "payload";
export const QUEUE_VERSION = 1;

export const SANDBOX_CAPABILITIES = ["CHOWN", "DAC_OVERRIDE", "FOWNER", "KILL", "NET_BIND_SERVICE", "SETGID", "SETUID"] as const;
export const SANDBOX_STATUSES = ["ready", "failed", "destroyed"] as const;

const ATTEMPT_ID_MAX_LENGTH = 64;
const IMAGE_MAX_LENGTH = 512;
const SANDBOX_ID_MAX_LENGTH = 128;
const REASON_MAX_LENGTH = 500;
const CPU_MILLIS_MAX = 16_000;
const MEMORY_BYTES_MIN = 1_048_576;
const TTL_SECONDS_MAX = 7_200;

export const sandboxCreateSchema = z.strictObject({
  version: z.literal(QUEUE_VERSION),
  attempt_id: z.string().min(1).max(ATTEMPT_ID_MAX_LENGTH),
  image: z.string().min(1).max(IMAGE_MAX_LENGTH),
  seed: z.number().int().min(0).max(SEED_MAX),
  cpu_millis: z.number().int().min(1).max(CPU_MILLIS_MAX),
  memory_bytes: z.number().int().min(MEMORY_BYTES_MIN),
  ttl_seconds: z.number().int().min(1).max(TTL_SECONDS_MAX),
  network: z.enum(["none"]),
  capabilities: z
    .array(z.enum(SANDBOX_CAPABILITIES))
    .refine((items) => new Set(items).size === items.length, "capabilities must not repeat")
    .optional(),
});

export const sandboxStatusSchema = z
  .strictObject({
    version: z.literal(QUEUE_VERSION),
    attempt_id: z.string().min(1).max(ATTEMPT_ID_MAX_LENGTH),
    status: z.enum(SANDBOX_STATUSES),
    sandbox_id: z.string().min(1).max(SANDBOX_ID_MAX_LENGTH).optional(),
    reason: z.string().max(REASON_MAX_LENGTH).optional(),
  })
  .refine((message) => message.status !== "ready" || message.sandbox_id !== undefined, {
    message: "a ready status needs sandbox_id",
    path: ["sandbox_id"],
  });

export type SandboxCreate = z.infer<typeof sandboxCreateSchema>;
export type SandboxStatus = z.infer<typeof sandboxStatusSchema>;

// The API asks the engine to destroy a sandbox early; "abandoned" is reported back on sandbox.status.
export const sandboxDestroySchema = z.strictObject({
  version: z.literal(QUEUE_VERSION),
  attempt_id: z.string().min(1).max(ATTEMPT_ID_MAX_LENGTH),
  reason: z.enum(["abandoned"]),
});

export type SandboxDestroy = z.infer<typeof sandboxDestroySchema>;

export const FINISHED_ATTEMPT_STATUSES = ["solved", "failed", "expired", "abandoned"] as const;

// The API records it through the outbox when an attempt reaches a final status; worker jobs start from it.
export const attemptFinishedSchema = z.strictObject({
  version: z.literal(QUEUE_VERSION),
  attempt_id: z.uuid(),
  user_id: z.uuid(),
  challenge_version_id: z.uuid(),
  status: z.enum(FINISHED_ATTEMPT_STATUSES),
  duration_ms: z.number().int().min(0).optional(),
  checks_used: z.number().int().min(0).max(ATTEMPT_MAX_CHECKS),
  finished_at: z.iso.datetime(),
});

export type AttemptFinished = z.infer<typeof attemptFinishedSchema>;

import { z } from "zod";

export const ERROR_CODES = [
  "validation_failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "unavailable",
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

// Single error format for every API response: {code, message, details}.
export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

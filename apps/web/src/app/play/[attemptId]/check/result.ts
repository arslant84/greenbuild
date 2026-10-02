import { z } from "zod";

// The engine's check result, passed through unchanged by the check route.
export const checkResultSchema = z.object({
  passed: z.boolean(),
  output_tail: z.string(),
  duration_ms: z.number(),
});

export type CheckResult = z.infer<typeof checkResultSchema>;

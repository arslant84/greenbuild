import { API_DEFAULT_PORT, ValidationError } from "@greenbuild/shared";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(API_DEFAULT_PORT),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ValidationError("Invalid environment variables", z.flattenError(result.error));
  }
  return result.data;
}

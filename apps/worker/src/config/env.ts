import { ValidationError, WORKER_DEFAULT_PORT } from "@greenbuild/shared";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(WORKER_DEFAULT_PORT),
    // The outbox relay runs only with both; they hold passwords, so errors never echo them.
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
  })
  .refine((env) => (env.DATABASE_URL === undefined) === (env.REDIS_URL === undefined), {
    message: "DATABASE_URL and REDIS_URL must be set together",
    path: ["REDIS_URL"],
  });

export type Env = z.infer<typeof envSchema>;

// Empty variables count as unset, so a blank line in an env file does not fail startup.
export function loadEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new ValidationError("Invalid environment variables", z.flattenError(result.error));
  }
  return result.data;
}

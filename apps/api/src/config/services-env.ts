import { ValidationError } from "@greenbuild/shared";
import { z } from "zod";

// Shorter secrets are easier to brute-force; 32 bytes is the HS256 key size.
const MIN_SECRET_LENGTH = 32;

const servicesEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  // Signs the 60-second attach tokens; the engine verifies them with the same secret.
  ATTACH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  // The engine's internal API, for checks; the token is its SANDBOX_ENGINE_INTERNAL_TOKEN.
  ENGINE_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
  ENGINE_INTERNAL_TOKEN: z.string().min(MIN_SECRET_LENGTH),
  // Verifies dev user tokens until Auth.js login exists; ignored in production.
  DEV_AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
});

export type ServicesEnv = z.infer<typeof servicesEnvSchema>;

// loadServicesEnv reports which variables are wrong, never their values: they hold passwords and keys.
export function loadServicesEnv(source: Record<string, string | undefined>): ServicesEnv {
  const result = servicesEnvSchema.safeParse({ ...source, DEV_AUTH_SECRET: source.DEV_AUTH_SECRET || undefined });
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ValidationError("Invalid environment variables", { variables });
  }
  return result.data;
}

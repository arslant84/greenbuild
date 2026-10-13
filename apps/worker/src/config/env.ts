import { ValidationError, WORKER_DEFAULT_PORT } from "@greenbuild/shared";
import { z } from "zod";

const EXPORT_SETTINGS = ["EXPORT_BLOB_CONNECTION_STRING", "EMAIL_SERVER", "EMAIL_FROM", "WEB_URL"] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(WORKER_DEFAULT_PORT),
    // The outbox relay runs only with both; they hold passwords, so errors never echo them.
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    // Where the engine saves session logs (task 49b reads them for anti-cheat signals); holds a key.
    SESSION_BLOB_CONNECTION_STRING: z.string().min(1).optional(),
    // The data export job (task 50a) runs only with all four: where archives go (holds a key), how the
    // link is emailed (Mailpit locally), and the web app the link opens.
    EXPORT_BLOB_CONNECTION_STRING: z.string().min(1).optional(),
    EMAIL_SERVER: z.url({ protocol: /^smtps?$/ }).optional(),
    EMAIL_FROM: z.email().optional(),
    WEB_URL: z.url({ protocol: /^https?$/ }).optional(),
  })
  .refine((env) => (env.DATABASE_URL === undefined) === (env.REDIS_URL === undefined), {
    message: "DATABASE_URL and REDIS_URL must be set together",
    path: ["REDIS_URL"],
  })
  .refine((env) => new Set(EXPORT_SETTINGS.map((name) => env[name] === undefined)).size === 1, {
    message: `${EXPORT_SETTINGS.join(", ")} must be set together`,
    path: ["EXPORT_BLOB_CONNECTION_STRING"],
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

import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

// loadDatabaseUrl validates DATABASE_URL. It holds the password, so a bad value is reported by name only.
export function loadDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const parsed = databaseEnvSchema.safeParse({ DATABASE_URL: env.DATABASE_URL });
  if (!parsed.success) {
    throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL");
  }
  return parsed.data.DATABASE_URL;
}

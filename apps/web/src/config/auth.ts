import { z } from "zod";

const MIN_SECRET_LENGTH = 32;

const authEnvSchema = z
  .object({
    AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Where sign-in links are sent from: Mailpit locally, the D6 provider's SMTP elsewhere.
    EMAIL_SERVER: z.url({ protocol: /^smtps?$/ }),
    EMAIL_FROM: z.email(),
    AUTH_GITHUB_ID: z.string().min(1).optional(),
    AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  })
  .refine((env) => (env.AUTH_GITHUB_ID === undefined) === (env.AUTH_GITHUB_SECRET === undefined), {
    message: "set both AUTH_GITHUB_ID and AUTH_GITHUB_SECRET, or neither",
  });

export interface AuthConfig {
  // Signs and encrypts the session; never log it.
  secret: string;
  databaseUrl: string;
  emailServer: string;
  emailFrom: string;
  // Sign-in with GitHub needs an OAuth app; without one only the email link is offered.
  github: { clientId: string; clientSecret: string } | null;
}

// loadAuthConfig answers null when AUTH_SECRET is unset, so local runs without sign-in keep the dev
// session (task 30e removes it); in production sign-in is required.
export function loadAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  if (!env.AUTH_SECRET) {
    if (env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET: required in production");
    }
    return null;
  }
  const parsed = authEnvSchema.parse({
    AUTH_SECRET: env.AUTH_SECRET,
    DATABASE_URL: env.DATABASE_URL,
    EMAIL_SERVER: env.EMAIL_SERVER,
    EMAIL_FROM: env.EMAIL_FROM,
    AUTH_GITHUB_ID: env.AUTH_GITHUB_ID || undefined,
    AUTH_GITHUB_SECRET: env.AUTH_GITHUB_SECRET || undefined,
  });
  const { AUTH_GITHUB_ID: clientId, AUTH_GITHUB_SECRET: clientSecret } = parsed;
  return {
    secret: parsed.AUTH_SECRET,
    databaseUrl: parsed.DATABASE_URL,
    emailServer: parsed.EMAIL_SERVER,
    emailFrom: parsed.EMAIL_FROM,
    github: clientId && clientSecret ? { clientId, clientSecret } : null,
  };
}

import { z } from "zod";

const MIN_SECRET_LENGTH = 32;

const authEnvSchema = z
  .object({
    AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Where sign-in links are sent from: Mailpit locally, the D6 provider's SMTP elsewhere.
    EMAIL_SERVER: z.url({ protocol: /^smtps?$/ }),
    EMAIL_FROM: z.email(),
    // Signs the 5-minute API tokens (task 30c): an EC P-256 JWK with its private part, on one line.
    API_TOKEN_PRIVATE_KEY: z.string().refine(isPrivateP256Jwk, "must be an EC P-256 private JWK"),
    AUTH_GITHUB_ID: z.string().min(1).optional(),
    AUTH_GITHUB_SECRET: z.string().min(1).optional(),
    AUTH_GOOGLE_ID: z.string().min(1).optional(),
    AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  })
  .refine((env) => (env.AUTH_GITHUB_ID === undefined) === (env.AUTH_GITHUB_SECRET === undefined), {
    message: "set both AUTH_GITHUB_ID and AUTH_GITHUB_SECRET, or neither",
  })
  .refine((env) => (env.AUTH_GOOGLE_ID === undefined) === (env.AUTH_GOOGLE_SECRET === undefined), {
    message: "set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither",
  });

// An OAuth app's client id and secret; sign-in with that provider is offered only when both are set.
export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}

export interface AuthConfig {
  // Signs and encrypts the session; never log it.
  secret: string;
  databaseUrl: string;
  emailServer: string;
  emailFrom: string;
  // Never log it.
  apiTokenPrivateKey: string;
  // Sign-in with GitHub and Google needs an OAuth app each (Google: task 54).
  github: OAuthApp | null;
  google: OAuthApp | null;
  // The test sign-in for Playwright (task 30d): GREENBUILD_E2E_AUTH=1, never in production.
  e2eSignIn: boolean;
}

// loadAuthConfig answers null when AUTH_SECRET is unset, so local runs without sign-in keep the dev
// session (task 30e removes it); in production sign-in is required.
export function loadAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const e2eSignIn = env.GREENBUILD_E2E_AUTH === "1";
  if (e2eSignIn && env.NODE_ENV === "production") {
    throw new Error("GREENBUILD_E2E_AUTH: the test sign-in never runs in production");
  }
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
    API_TOKEN_PRIVATE_KEY: env.API_TOKEN_PRIVATE_KEY,
    AUTH_GITHUB_ID: env.AUTH_GITHUB_ID || undefined,
    AUTH_GITHUB_SECRET: env.AUTH_GITHUB_SECRET || undefined,
    AUTH_GOOGLE_ID: env.AUTH_GOOGLE_ID || undefined,
    AUTH_GOOGLE_SECRET: env.AUTH_GOOGLE_SECRET || undefined,
  });
  return {
    secret: parsed.AUTH_SECRET,
    databaseUrl: parsed.DATABASE_URL,
    emailServer: parsed.EMAIL_SERVER,
    emailFrom: parsed.EMAIL_FROM,
    apiTokenPrivateKey: parsed.API_TOKEN_PRIVATE_KEY,
    github: oauthApp(parsed.AUTH_GITHUB_ID, parsed.AUTH_GITHUB_SECRET),
    google: oauthApp(parsed.AUTH_GOOGLE_ID, parsed.AUTH_GOOGLE_SECRET),
    e2eSignIn,
  };
}

function oauthApp(clientId: string | undefined, clientSecret: string | undefined): OAuthApp | null {
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const privateP256JwkSchema = z.looseObject({ kty: z.literal("EC"), crv: z.literal("P-256"), x: z.string(), y: z.string(), d: z.string() });

function isPrivateP256Jwk(value: string): boolean {
  try {
    return privateP256JwkSchema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
}

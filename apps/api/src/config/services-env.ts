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
  // The web app's public key for API tokens (task 30c): an EC P-256 JWK on one line, never the private key.
  API_TOKEN_PUBLIC_KEY: z.string().refine(isPublicP256Jwk).optional(),
}).refine((env) => env.NODE_ENV !== "production" || env.API_TOKEN_PUBLIC_KEY !== undefined, {
  path: ["API_TOKEN_PUBLIC_KEY"],
  message: "required in production",
});

const publicP256JwkSchema = z.looseObject({ kty: z.literal("EC"), crv: z.literal("P-256"), x: z.string(), y: z.string() });

function isPublicP256Jwk(value: string): boolean {
  try {
    const jwk: unknown = JSON.parse(value);
    return publicP256JwkSchema.safeParse(jwk).success && !Object.hasOwn(jwk as object, "d");
  } catch {
    return false;
  }
}

export type ServicesEnv = z.infer<typeof servicesEnvSchema>;

// loadServicesEnv reports which variables are wrong, never their values: they hold passwords and keys.
export function loadServicesEnv(source: Record<string, string | undefined>): ServicesEnv {
  const result = servicesEnvSchema.safeParse({
    ...source,
    DEV_AUTH_SECRET: source.DEV_AUTH_SECRET || undefined,
    API_TOKEN_PUBLIC_KEY: source.API_TOKEN_PUBLIC_KEY || undefined,
  });
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ValidationError("Invalid environment variables", { variables });
  }
  return result.data;
}

import { API_TOKEN_ALGORITHM, API_TOKEN_AUDIENCE, API_TOKEN_ISSUER, API_TOKEN_LIFETIME_SEC } from "@greenbuild/shared";
import { importJWK, type JWK, jwtVerify } from "jose";
import { z } from "zod";
import type { AuthenticatedUser } from "./dev-user-token.js";

type VerifyKey = Exclude<Awaited<ReturnType<typeof importJWK>>, Uint8Array>;

const userIdSchema = z.uuid();

// apiTokenKey imports the web app's public key (API_TOKEN_PUBLIC_KEY, validated by loadServicesEnv).
export async function apiTokenKey(publicJwk: string): Promise<VerifyKey> {
  const key = await importJWK(JSON.parse(publicJwk) as JWK, API_TOKEN_ALGORITHM);
  if (key instanceof Uint8Array) {
    throw new Error("API_TOKEN_PUBLIC_KEY: must be an EC public key");
  }
  return key;
}

// verifyApiToken returns null for anything but an ES256 token from the web app for this API, issued at
// most API_TOKEN_LIFETIME_SEC ago and still valid, naming a user (task 30c).
export async function verifyApiToken(key: VerifyKey, token: string): Promise<AuthenticatedUser | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [API_TOKEN_ALGORITHM],
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE,
      requiredClaims: ["exp", "iat", "sub"],
      maxTokenAge: API_TOKEN_LIFETIME_SEC,
    });
    const userId = userIdSchema.safeParse(payload.sub);
    return userId.success ? { id: userId.data } : null;
  } catch {
    return null;
  }
}

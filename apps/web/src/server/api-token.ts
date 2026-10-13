import { API_TOKEN_ALGORITHM, API_TOKEN_AUDIENCE, API_TOKEN_ISSUER, API_TOKEN_LIFETIME_SEC } from "@greenbuild/shared";
import { importJWK, type JWK, SignJWT } from "jose";

type SigningKey = Exclude<Awaited<ReturnType<typeof importJWK>>, Uint8Array>;

// The key is imported once per process; the JWK comes from the validated auth settings.
const keys = new Map<string, Promise<SigningKey>>();

async function importSigningKey(privateJwk: string): Promise<SigningKey> {
  const key = await importJWK(JSON.parse(privateJwk) as JWK, API_TOKEN_ALGORITHM);
  if (key instanceof Uint8Array) {
    throw new Error("API_TOKEN_PRIVATE_KEY: must be an EC private key");
  }
  return key;
}

// signApiToken issues the token the API admits a signed-in user by (task 30c): ES256, 5 minutes,
// for this user only. It is made per request and never reaches the browser.
export async function signApiToken(privateJwk: string, userId: string): Promise<string> {
  let key = keys.get(privateJwk);
  if (!key) {
    key = importSigningKey(privateJwk);
    keys.set(privateJwk, key);
  }
  return new SignJWT({})
    .setProtectedHeader({ alg: API_TOKEN_ALGORITHM })
    .setIssuer(API_TOKEN_ISSUER)
    .setAudience(API_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${API_TOKEN_LIFETIME_SEC}s`)
    .sign(await key);
}
